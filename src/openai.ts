export type GenerateSubTasksParams = {
  apiKey: string;
  model: string;
  parentTodoText: string;
  existingSubTaskTexts: string[];
};

export type RankTodosParams = {
  apiKey: string;
  model: string;
  todos: Array<{ id: string; text: string }>;
};

export type RankTodosResult = {
  orderedIds: string[];
  priorities: Record<string, 1 | 2 | 3 | 4 | 5>;
};

type RawSubTask = {
  text: unknown;
};

type RawSubTaskResponse = {
  subtasks?: RawSubTask[];
};

type RawTodoRank = {
  id: unknown;
  priority: unknown;
};

type RawTodoOrderResponse = {
  ordered?: unknown;
};

export class AppError extends Error {
  readonly code: "MISSING_API_KEY" | "OPENAI_API_ERROR" | "INVALID_JSON";

  constructor(code: AppError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function clampRankPriority(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 3;
  }
  if (parsed <= 1) {
    return 1;
  }
  if (parsed >= 5) {
    return 5;
  }
  return parsed as 1 | 2 | 3 | 4 | 5;
}

function normalizeApiKey(apiKey: string): string {
  const normalized = apiKey.trim();
  if (!normalized) {
    throw new AppError("MISSING_API_KEY", "OpenAI APIキーが設定されていません。");
  }
  return normalized;
}

function toJsonText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new AppError("INVALID_JSON", "AI応答が空です。");
  }

  const candidate = payload as { output_text?: unknown; output?: unknown };
  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) {
    return candidate.output_text;
  }

  if (Array.isArray(candidate.output)) {
    for (const outputItem of candidate.output) {
      if (
        outputItem &&
        typeof outputItem === "object" &&
        "content" in outputItem &&
        Array.isArray((outputItem as { content?: unknown }).content)
      ) {
        for (const contentItem of (outputItem as { content: unknown[] }).content) {
          if (
            contentItem &&
            typeof contentItem === "object" &&
            "text" in contentItem &&
            typeof (contentItem as { text?: unknown }).text === "string"
          ) {
            const text = (contentItem as { text: string }).text;
            if (text.trim()) {
              return text;
            }
          }
        }
      }
    }
  }

  throw new AppError("INVALID_JSON", "AI応答のJSONを読み取れませんでした。");
}

async function callResponsesApi(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<unknown> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model.trim(),
      input: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      max_output_tokens: 800,
      text: {
        format: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    throw new AppError("OPENAI_API_ERROR", `OpenAI APIエラー: ${response.status}${detail ? ` ${detail}` : ""}`);
  }

  try {
    return await response.json();
  } catch {
    throw new AppError("INVALID_JSON", "OpenAI APIレスポンスがJSONではありません。");
  }
}

export async function generateSubTasks(params: GenerateSubTasksParams): Promise<Array<{ text: string }>> {
  const apiKey = normalizeApiKey(params.apiKey);
  const existingTextSet = new Set(params.existingSubTaskTexts.map((text) => text.trim()).filter(Boolean));

  const systemPrompt = [
    "あなたはTODO分解のアシスタントです。",
    "親TODOを、実行可能な子タスクに分解してください。",
    "不必要に細かく分割せず、実行に十分な粒度で提案してください。",
    "必ずJSONのみ返してください。",
    '形式: {"subtasks":[{"text":"..."}]}',
    "subtasks件数は0-4件。",
    "既存子タスクと完全一致するtextは出さない。",
  ].join("\n");

  const userPrompt = [
    `親TODO: ${params.parentTodoText}`,
    `既存子タスク: ${existingTextSet.size > 0 ? JSON.stringify(Array.from(existingTextSet)) : "[]"}`,
  ].join("\n");

  const payload = await callResponsesApi({
    apiKey,
    model: params.model,
    systemPrompt,
    userPrompt,
    schemaName: "subtasks_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subtasks: {
          type: "array",
          minItems: 0,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", minLength: 1 },
            },
            required: ["text"],
          },
        },
      },
      required: ["subtasks"],
    },
  });

  let modelJson: RawSubTaskResponse;
  try {
    modelJson = JSON.parse(toJsonText(payload)) as RawSubTaskResponse;
  } catch {
    throw new AppError("INVALID_JSON", "AI応答JSONの解析に失敗しました。");
  }

  if (!Array.isArray(modelJson.subtasks)) {
    throw new AppError("INVALID_JSON", "AI応答にsubtasks配列がありません。");
  }

  const newResults: Array<{ text: string }> = [];
  const seen = new Set<string>();

  for (const item of modelJson.subtasks) {
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) {
      continue;
    }
    if (existingTextSet.has(text) || seen.has(text)) {
      continue;
    }
    seen.add(text);
    newResults.push({ text });
  }

  return newResults.slice(0, 4);
}

export async function rankTodosByAi(params: RankTodosParams): Promise<RankTodosResult> {
  const apiKey = normalizeApiKey(params.apiKey);

  if (params.todos.length <= 1) {
    const single = params.todos[0];
    return {
      orderedIds: params.todos.map((todo) => todo.id),
      priorities: single ? { [single.id]: 3 } : {},
    };
  }

  const systemPrompt = [
    "あなたはタスク優先順位付けのアシスタントです。",
    "与えられた親TODO全体を、実行すべき順番に並べ替えてください。",
    "各タスクにpriority(1-5)を付けてください。1が最優先です。",
    "優先順位の判定基準は以下を厳密に使ってください。",
    "1：今すぐ（今日中・期限が迫っている／放置すると即ダメージ）",
    "2：かなり急ぎ（1–2日以内／遅れると影響が大きい）",
    "3：普通（今週中／遅れても致命的ではないが早めが良い）",
    "4：低め（今月中／空いた時間で対応）",
    "5：いつか（期限なし／気が向いたとき・余裕があるとき）",
    "priorityは重複しても構いません。重要そうなものとそうでないものの差をはっきり付けてください。",
    "必ずJSONのみ返してください。",
    '形式: {"ordered":[{"id":"id1","priority":1}]}',
    "入力で与えられたIDだけを使い、重複なしで返してください。",
  ].join("\n");

  const userPrompt = `親TODO一覧: ${JSON.stringify(params.todos)}`;

  const payload = await callResponsesApi({
    apiKey,
    model: params.model,
    systemPrompt,
    userPrompt,
    schemaName: "todo_order_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ordered: {
          type: "array",
          minItems: 0,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", minLength: 1 },
              priority: { type: "integer", minimum: 1, maximum: 5 },
            },
            required: ["id", "priority"],
          },
        },
      },
      required: ["ordered"],
    },
  });

  let modelJson: RawTodoOrderResponse;
  try {
    modelJson = JSON.parse(toJsonText(payload)) as RawTodoOrderResponse;
  } catch {
    throw new AppError("INVALID_JSON", "AI応答JSONの解析に失敗しました。");
  }

  if (!Array.isArray(modelJson.ordered)) {
    throw new AppError("INVALID_JSON", "AI応答にordered配列がありません。");
  }

  const inputIds = new Set(params.todos.map((todo) => todo.id));
  const orderedIds: string[] = [];
  const priorities: Record<string, 1 | 2 | 3 | 4 | 5> = {};
  const seen = new Set<string>();

  for (const item of modelJson.ordered as RawTodoRank[]) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      continue;
    }
    if (!inputIds.has(item.id) || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    orderedIds.push(item.id);
    priorities[item.id] = clampRankPriority(item.priority);
  }

  return {
    orderedIds,
    priorities,
  };
}
