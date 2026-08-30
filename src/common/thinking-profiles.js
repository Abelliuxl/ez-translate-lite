// --- 思考参数适配层 ---
//
// 不同供应商/模型关闭思考、调节思考强度的请求格式各不相同：
//   - OpenRouter 统一参数:     reasoning: { enabled: false } / { effort: 'low' }
//   - 硅基流动/智谱/GLM 风格:  thinking: { type: 'disabled' }
//   - DeepSeek 系(中转):       reasoning_effort: 'none'
//   - Anthropic 格式:          thinking: { type: 'enabled', budget_tokens: N }（不带字段 = 关闭）
//   - Command Code 网关:       reasoning_effort 仅接受 low|medium|high|xhigh|max
//
// 本文件是"供应商 + 模型 -> 请求参数格式"的可持续适配规则表：
// 背景脚本发请求前按当前模型查表合并参数；设置页按当前模型动态渲染可选强度档位。
// 需要新供应商/新模型时，直接在 BUILTIN_PROFILES 里补一条规则，或在设置页的
// "思考兼容规则"里添加用户自定义规则（命中优先级：用户规则 > 内置规则 > 默认兜底）。
//
// 规则字段说明：
//   id          规则标识（日志与展示用）
//   note        人类可读说明，设置页会展示
//   providers   可选，内置 provider id 数组（如 ['openrouter']）
//   endpoints   可选，端点域名片段数组，contains 匹配（如 ['openrouter.ai']）
//               providers 与 endpoints 都缺省 = 对所有供应商生效
//   models      模型通配符数组（'*' 通配，大小写不敏感，如 ['glm-*']），缺省 = 匹配所有模型
//   off         关闭思考时并入请求体的参数对象；null = 该模型无法关闭（开关关闭时不发任何参数并提示）
//   levels      开启思考时的可选强度档位 [{ value, label, params }]
//   effortParam 自定义强度值（不在 levels 中）的构造路径，如 ['reasoning','effort'] => reasoning:{effort:value}
//   apiFormat   可选，按模型强制切换请求格式（如 commandcode 的 claude-* 走 'anthropic'）
//   endpoint    可选，切换格式时使用的请求端点
//   requestOverrides  可选，并入请求体的其它覆盖项；值为 null 时表示从请求体中移除该字段
//                     （如 kimi-k3 拒绝 temperature 参数，可用 {"temperature": null} 移除）
(function (global) {
    'use strict';

    const BUILTIN_PROFILES = [
        {
            id: 'openrouter',
            note: 'OpenRouter 统一参数：reasoning.enabled=false 关闭思考，强度走 reasoning.effort',
            providers: ['openrouter'],
            endpoints: ['openrouter.ai'],
            models: ['*'],
            off: { reasoning: { enabled: false } },
            levels: [
                { value: 'low', label: '低', params: { reasoning: { effort: 'low' } } },
                { value: 'medium', label: '中', params: { reasoning: { effort: 'medium' } } },
                { value: 'high', label: '高', params: { reasoning: { effort: 'high' } } }
            ],
            effortParam: ['reasoning', 'effort']
        },
        {
            id: 'opencode-go-glm',
            note: 'OpenCode Go 的 GLM 系列上游强制思考、无法关闭（关闭参数会直接报错）；强度支持 low/high/max',
            providers: ['opencode-go'],
            endpoints: ['opencode.ai'],
            models: ['glm-*'],
            off: null,
            levels: [
                { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
                { value: 'high', label: '高', params: { reasoning_effort: 'high' } },
                { value: 'max', label: '最大', params: { reasoning_effort: 'max' } }
            ],
            effortParam: ['reasoning_effort']
        },
        {
            id: 'opencode-go-deepseek',
            note: 'OpenCode Go 的 DeepSeek 系列：reasoning_effort=none 关闭思考',
            providers: ['opencode-go'],
            endpoints: ['opencode.ai'],
            models: ['deepseek-*', 'deepseek/*'],
            off: { reasoning_effort: 'none' },
            levels: [
                { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
                { value: 'medium', label: '中', params: { reasoning_effort: 'medium' } },
                { value: 'high', label: '高', params: { reasoning_effort: 'high' } }
            ],
            effortParam: ['reasoning_effort']
        },
        {
            id: 'opencode-go-qwen',
            note: 'OpenCode Go 的 Qwen 系列：thinking={type:disabled} 关闭思考，强度走 reasoning_effort',
            providers: ['opencode-go'],
            endpoints: ['opencode.ai'],
            models: ['qwen*', 'qwen/*'],
            off: { thinking: { type: 'disabled' } },
            levels: [
                { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
                { value: 'medium', label: '中', params: { reasoning_effort: 'medium' } },
                { value: 'high', label: '高', params: { reasoning_effort: 'high' } }
            ],
            effortParam: ['reasoning_effort']
        },
        {
            id: 'opencode-go-default',
            note: 'OpenCode Go 其它模型（kimi/minimax/longcat/mimo 等）：thinking={type:disabled} 关闭思考；实测 kimi-k3 拒绝 temperature 参数，故默认移除',
            providers: ['opencode-go'],
            endpoints: ['opencode.ai'],
            models: ['*'],
            off: { thinking: { type: 'disabled' } },
            levels: [
                { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
                { value: 'medium', label: '中', params: { reasoning_effort: 'medium' } },
                { value: 'high', label: '高', params: { reasoning_effort: 'high' } }
            ],
            effortParam: ['reasoning_effort'],
            requestOverrides: { temperature: null }
        },
        {
            id: 'commandcode-claude',
            note: 'Command Code 的 Claude 系列必须走 Anthropic /messages 格式；默认不思考，开启时用 thinking.budget_tokens',
            providers: ['commandcode'],
            endpoints: ['api.commandcode.ai'],
            models: ['claude-*'],
            apiFormat: 'anthropic',
            endpoint: 'https://api.commandcode.ai/provider/v1/messages',
            off: {},
            levels: [
                { value: 'low', label: '低', params: { thinking: { type: 'enabled', budget_tokens: 2048 } } },
                { value: 'medium', label: '中', params: { thinking: { type: 'enabled', budget_tokens: 8192 } } },
                { value: 'high', label: '高', params: { thinking: { type: 'enabled', budget_tokens: 16384 } } }
            ]
        },
        {
            id: 'commandcode-gpt',
            note: 'Command Code 的 GPT 系列默认不思考（不传参数即关闭）；强度仅接受 low/medium/high/xhigh/max',
            providers: ['commandcode'],
            endpoints: ['api.commandcode.ai'],
            models: ['gpt-*'],
            off: {},
            levels: [
                { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
                { value: 'medium', label: '中', params: { reasoning_effort: 'medium' } },
                { value: 'high', label: '高', params: { reasoning_effort: 'high' } },
                { value: 'xhigh', label: '超高', params: { reasoning_effort: 'xhigh' } },
                { value: 'max', label: '最大', params: { reasoning_effort: 'max' } }
            ],
            effortParam: ['reasoning_effort']
        },
        {
            id: 'commandcode-deepseek',
            note: 'Command Code 的 DeepSeek 系列实测无法关闭思考（关闭参数被上游忽略）；强度走 reasoning_effort',
            providers: ['commandcode'],
            endpoints: ['api.commandcode.ai'],
            models: ['deepseek-*', 'deepseek/*'],
            off: null,
            levels: [
                { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
                { value: 'medium', label: '中', params: { reasoning_effort: 'medium' } },
                { value: 'high', label: '高', params: { reasoning_effort: 'high' } },
                { value: 'xhigh', label: '超高', params: { reasoning_effort: 'xhigh' } },
                { value: 'max', label: '最大', params: { reasoning_effort: 'max' } }
            ],
            effortParam: ['reasoning_effort']
        }
    ];

    // 未命中任何规则时的兜底行为（与 v2.3.0 及之前保持一致）：
    // thinking={type:disabled} 关闭（智谱/硅基流动等识别），开启时 reasoning_effort 传强度
    const DEFAULT_PROFILE = {
        id: 'default',
        note: '默认格式：thinking={type:disabled} 关闭思考，强度走 reasoning_effort',
        off: { thinking: { type: 'disabled' } },
        levels: [
            { value: 'low', label: '低', params: { reasoning_effort: 'low' } },
            { value: 'medium', label: '中', params: { reasoning_effort: 'medium' } },
            { value: 'high', label: '高', params: { reasoning_effort: 'high' } }
        ],
        effortParam: ['reasoning_effort']
    };

    function globToRegExp(pattern) {
        const escaped = String(pattern).trim()
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        return new RegExp(`^${escaped}$`, 'i');
    }

    function matchModel(patterns, model) {
        if (!Array.isArray(patterns) || patterns.length === 0) return true;
        const value = String(model || '').trim();
        if (!value) return patterns.includes('*');
        return patterns.some((p) => globToRegExp(p).test(value));
    }

    function matchEndpoints(hosts, endpoint) {
        if (!Array.isArray(hosts) || hosts.length === 0) return false;
        const value = String(endpoint || '').toLowerCase();
        if (!value) return false;
        return hosts.some((h) => value.includes(String(h).toLowerCase()));
    }

    function ruleMatches(rule, ctx) {
        if (!rule || typeof rule !== 'object') return false;
        const hasScope = Array.isArray(rule.providers) || Array.isArray(rule.endpoints);
        if (hasScope) {
            const byProvider = Array.isArray(rule.providers) && ctx.provider && rule.providers.includes(ctx.provider);
            const byEndpoint = matchEndpoints(rule.endpoints, ctx.endpoint);
            if (!byProvider && !byEndpoint) return false;
        }
        return matchModel(rule.models, ctx.model);
    }

    // 校验并规整用户自定义规则（来自设置页 JSON），非法条目直接丢弃
    function sanitizeRules(list) {
        if (!Array.isArray(list)) return [];
        return list.filter((r) => r && typeof r === 'object' && !Array.isArray(r)).map((r) => {
            const rule = { id: String(r.id || 'user-rule') };
            if (r.note) rule.note = String(r.note);
            if (Array.isArray(r.providers)) rule.providers = r.providers.map(String);
            if (Array.isArray(r.endpoints)) rule.endpoints = r.endpoints.map(String);
            if (Array.isArray(r.models)) rule.models = r.models.map(String);
            if (r.off === null) rule.off = null;
            else if (r.off && typeof r.off === 'object' && !Array.isArray(r.off)) rule.off = r.off;
            if (Array.isArray(r.levels)) {
                rule.levels = r.levels.filter((l) => l && typeof l === 'object' && l.params && typeof l.params === 'object')
                    .map((l) => ({ value: String(l.value), label: String(l.label || l.value), params: l.params }));
            }
            if (Array.isArray(r.effortParam) && r.effortParam.every((k) => typeof k === 'string')) {
                rule.effortParam = r.effortParam;
            }
            if (typeof r.apiFormat === 'string') rule.apiFormat = r.apiFormat;
            if (typeof r.endpoint === 'string') rule.endpoint = r.endpoint;
            if (r.requestOverrides && typeof r.requestOverrides === 'object' && !Array.isArray(r.requestOverrides)) {
                rule.requestOverrides = r.requestOverrides;
            }
            return rule;
        });
    }

    // ctx: { provider, endpoint, model }，任一维度允许缺省
    function resolveThinkingProfile(ctx, userRules) {
        const all = [...sanitizeRules(userRules), ...BUILTIN_PROFILES];
        const found = all.find((r) => ruleMatches(r, ctx || {}));
        if (found) return { ...found };
        return { ...DEFAULT_PROFILE, levels: DEFAULT_PROFILE.levels.map((l) => ({ ...l })) };
    }

    function setByPath(target, path, value) {
        let obj = target;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {};
            obj = obj[key];
        }
        obj[path[path.length - 1]] = value;
    }

    // 按规则构造需要并入请求体的思考参数
    // profile.off === null 表示无法关闭：关闭时返回 {}（不发参数，避免被上游 400 拒绝）
    function buildThinkingParams(profile, thinkingEnabled, effortValue) {
        const params = {};
        const p = profile || DEFAULT_PROFILE;

        if (!thinkingEnabled) {
            if (p.off === null || p.off === undefined) return params;
            if (typeof p.off === 'object') return Object.assign(params, p.off);
            return params;
        }

        const value = String(effortValue || '').trim();
        if (!value) return params;

        const level = (Array.isArray(p.levels) ? p.levels : []).find((l) => l && l.value === value);
        if (level && level.params) return Object.assign(params, level.params);

        if (Array.isArray(p.effortParam) && p.effortParam.length) {
            setByPath(params, p.effortParam, value);
        }
        return params;
    }

    global.EZThinkingProfiles = {
        BUILTIN_PROFILES,
        DEFAULT_PROFILE,
        resolveThinkingProfile,
        buildThinkingParams,
        sanitizeRules,
        ruleMatches
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
