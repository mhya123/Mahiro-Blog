/**
 * @file locales.mjs
 * @description 服务端日志 i18n 国际化。
 *
 * 通过 .env 中的 LOG_LANG 环境变量控制日志语言（zh / en），默认中文。
 * 使用方式：import { t } from './locales.mjs'
 *           log('INFO', t('server_started'), meta)
 */

const zh = {
  // ── 服务器生命周期 ──
  log_lang_hint:                    '日志语言: 中文',
  server_started:                   '服务已启动',
  incoming_request:                 '收到请求',
  request_completed:                '请求完成',
  route_not_found:                  '请求被拒绝：路由不存在',
  sigterm_shutdown:                 '收到 SIGTERM 信号，正在关闭...',
  sigint_shutdown:                  '收到 SIGINT 信号，正在关闭...',
  unhandled_rejection:              '未处理的 Promise 异常',
  uncaught_exception:               '未捕获的异常',
  route_handler_crashed:            '路由处理器崩溃，已返回 500',

  // ── Redis ──
  redis_fallback:                   'Redis 不可用，已切换至内存缓存',
  redis_connected:                  'Redis 已连接',
  redis_ready:                      'Redis 就绪',
  redis_error:                      'Redis 错误',
  redis_reconnecting:               'Redis 正在重连',
  redis_init_failed:                'Redis 初始化失败，降级为内存缓存',
  redis_get_failed:                 'Redis GET 失败',
  redis_set_failed:                 'Redis SET 失败',
  redis_del_failed:                 'Redis DEL 失败',
  redis_scan_del_failed:            'Redis SCAN+DEL 失败',

  // ── Drive 操作 ──
  drive_status_failed:              '网盘状态查询失败',
  drive_encrypted_rejected:         '网盘加密请求被拒绝',
  drive_secure_action_failed:       '网盘安全操作失败',
  drive_list_failed:                '网盘目录列表失败',
  drive_item_failed:                '网盘文件详情失败',
  drive_search_failed:              '网盘搜索失败',
  drive_mkdir_failed:               '网盘创建目录失败',
  drive_rename_failed:              '网盘重命名失败',
  drive_remove_failed:              '网盘删除失败',
  drive_move_failed:                '网盘移动失败',
  drive_copy_failed:                '网盘复制失败',
  drive_upload_failed:              '网盘上传失败',
  drive_raw_failed:                 '网盘文件直链代理失败',
  drive_list_cache_hit:             '网盘目录列表命中缓存',
  drive_item_cache_hit:             '网盘文件详情命中缓存',
  drive_search_cache_hit:           '网盘搜索命中缓存',

  // ── AList 上游 ──
  alist_status_failed:              'AList 状态检查失败',
  alist_upstream_completed:         'AList 上游请求完成',
  alist_upstream_retry_success:     'AList 上游请求重试成功',
  alist_upstream_retrying:          'AList 上游请求失败，正在重试',
  alist_upstream_failed:            'AList 上游请求失败',
  alist_auth_refreshing:            'AList 鉴权失败，正在刷新 Token 并重试',
  alist_token_restored:             'AList Token 已从 Redis 缓存恢复',
  alist_login_succeeded:            'AList 登录成功',
  alist_redirect_failed:            '网盘直链解析失败，回退到签名 URL',

  // ── AI 服务 ──
  ai_summary_started:               'AI 摘要请求开始',
  ai_summary_failed:                'AI 摘要请求失败',
  ai_translate_started:             'AI 翻译请求开始',
  ai_translate_failed:              'AI 翻译请求失败',
  ai_secure_action_failed:          'AI 安全操作失败',
  ai_upstream_started:              'AI 上游请求开始',
  ai_upstream_completed:            'AI 上游请求完成',
  ai_upstream_failed:               'AI 上游请求失败',
  ai_summary_disabled:              '摘要请求被拒绝：AI 摘要功能已禁用',
  ai_summary_missing_key:           '摘要请求被拒绝：缺少 OPENAI_API_KEY',
  ai_summary_missing_title:         '摘要请求被拒绝：缺少标题',
  ai_summary_missing_content:       '摘要请求被拒绝：缺少内容',
  ai_summary_missing_model:         '摘要请求被拒绝：缺少模型 ID',
  ai_summary_unsupported_model:     '摘要请求被拒绝：不支持的模型',
  ai_summary_no_text_capability:    '摘要请求被拒绝：模型不支持文本生成',
  ai_summary_generated:             'AI 摘要已生成',
  ai_translate_disabled:            '翻译请求被拒绝：AI 翻译功能已禁用',
  ai_translate_missing_key:         '翻译请求被拒绝：缺少 AI_TRANSLATE_API_KEY',
  ai_translate_missing_target:      '翻译请求被拒绝：缺少目标语言',
  ai_translate_missing_model:       '翻译请求被拒绝：缺少模型 ID',
  ai_translate_missing_items:       '翻译请求被拒绝：缺少待翻译项目',
  ai_translate_too_many_items:      '翻译请求被拒绝：项目过多',
  ai_translate_input_too_large:     '翻译请求被拒绝：输入字符过多',
  ai_translate_unsupported_model:   '翻译请求被拒绝：不支持的模型',
  ai_translate_no_text_capability:  '翻译请求被拒绝：模型不支持文本生成',
  ai_translate_wrong_lang_retry:    '翻译结果疑似语言错误，正在使用更强的提示词重试',
  ai_translate_json_parse_retry:    '翻译 JSON 解析失败，正在用严格提示词重试',
  ai_translate_count_mismatch_retry:'翻译结果数量不匹配，正在用精确数量提示词重试',
  ai_translate_count_mismatch:      '翻译结果数量不匹配，缺失项已用原文填充',
  ai_translate_generated:           'AI 翻译已完成',
  ai_encrypted_rejected:            'AI 加密请求被拒绝',
  ai_summary_invalid_body:          '摘要请求被拒绝：JSON 格式无效',
  ai_translate_invalid_body:        '翻译请求被拒绝：JSON 格式无效',
}

const en = {
  // ── Server lifecycle ──
  log_lang_hint:                    'Log language: English',
  server_started:                   'Server started',
  incoming_request:                 'Incoming request',
  request_completed:                'Request completed',
  route_not_found:                  'Request rejected: route not found',
  sigterm_shutdown:                 'SIGTERM received, shutting down...',
  sigint_shutdown:                  'SIGINT received, shutting down...',
  unhandled_rejection:              'Unhandled promise rejection',
  uncaught_exception:               'Uncaught exception',
  route_handler_crashed:            'Route handler crashed, returned 500',

  // ── Redis ──
  redis_fallback:                   'Redis unavailable — using in-memory cache fallback',
  redis_connected:                  'Redis connected',
  redis_ready:                      'Redis ready',
  redis_error:                      'Redis error',
  redis_reconnecting:               'Redis reconnecting',
  redis_init_failed:                'Redis initialization failed, falling back to memory',
  redis_get_failed:                 'Redis GET failed',
  redis_set_failed:                 'Redis SET failed',
  redis_del_failed:                 'Redis DEL failed',
  redis_scan_del_failed:            'Redis SCAN+DEL failed',

  // ── Drive operations ──
  drive_status_failed:              'Drive status failed',
  drive_encrypted_rejected:         'Drive encrypted request rejected',
  drive_secure_action_failed:       'Drive secure action failed',
  drive_list_failed:                'Drive list failed',
  drive_item_failed:                'Drive item failed',
  drive_search_failed:              'Drive search failed',
  drive_mkdir_failed:               'Drive mkdir failed',
  drive_rename_failed:              'Drive rename failed',
  drive_remove_failed:              'Drive remove failed',
  drive_move_failed:                'Drive move failed',
  drive_copy_failed:                'Drive copy failed',
  drive_upload_failed:              'Drive upload failed',
  drive_raw_failed:                 'Drive raw redirect failed',
  drive_list_cache_hit:             'Drive list cache hit',
  drive_item_cache_hit:             'Drive item cache hit',
  drive_search_cache_hit:           'Drive search cache hit',

  // ── AList upstream ──
  alist_status_failed:              'AList status check failed',
  alist_upstream_completed:         'AList upstream request completed',
  alist_upstream_retry_success:     'AList upstream request succeeded on retry',
  alist_upstream_retrying:          'AList upstream request failed, retrying',
  alist_upstream_failed:            'AList upstream request failed',
  alist_auth_refreshing:            'AList auth failed, refreshing token and retrying',
  alist_token_restored:             'AList token restored from Redis cache',
  alist_login_succeeded:            'AList login succeeded',
  alist_redirect_failed:            'Drive direct URL resolve failed, falling back to signed URL',

  // ── AI service ──
  ai_summary_started:               'AI summary request started',
  ai_summary_failed:                'AI summary request failed',
  ai_translate_started:             'AI translate request started',
  ai_translate_failed:              'AI translate request failed',
  ai_secure_action_failed:          'AI secure action failed',
  ai_upstream_started:              'AI upstream request started',
  ai_upstream_completed:            'AI upstream request completed',
  ai_upstream_failed:               'AI upstream request failed',
  ai_summary_disabled:              'Summary request rejected: AI summary is disabled',
  ai_summary_missing_key:           'Summary request rejected: missing OPENAI_API_KEY',
  ai_summary_missing_title:         'Summary request rejected: missing title',
  ai_summary_missing_content:       'Summary request rejected: missing content',
  ai_summary_missing_model:         'Summary request rejected: missing model ID',
  ai_summary_unsupported_model:     'Summary request rejected: unsupported model',
  ai_summary_no_text_capability:    'Summary request rejected: model has no text capability',
  ai_summary_generated:             'AI summary generated',
  ai_translate_disabled:            'Translate request rejected: AI translation is disabled',
  ai_translate_missing_key:         'Translate request rejected: missing AI_TRANSLATE_API_KEY',
  ai_translate_missing_target:      'Translate request rejected: missing target language',
  ai_translate_missing_model:       'Translate request rejected: missing model ID',
  ai_translate_missing_items:       'Translate request rejected: missing items',
  ai_translate_too_many_items:      'Translate request rejected: too many items',
  ai_translate_input_too_large:     'Translate request rejected: input too large',
  ai_translate_unsupported_model:   'Translate request rejected: unsupported model',
  ai_translate_no_text_capability:  'Translate request rejected: model has no text capability',
  ai_translate_wrong_lang_retry:    'Translation looked like the wrong language, retrying with stronger prompt',
  ai_translate_json_parse_retry:    'Translation JSON parse failed, retrying with strict prompt',
  ai_translate_count_mismatch_retry:'Translation item count mismatch, retrying with exact count prompt',
  ai_translate_count_mismatch:      'Translation item count mismatch, missing items padded with original text',
  ai_translate_generated:           'AI translation generated',
  ai_encrypted_rejected:            'AI encrypted request rejected',
  ai_summary_invalid_body:          'Summary request rejected: invalid JSON body',
  ai_translate_invalid_body:        'Translate request rejected: invalid JSON body',
}

const locales = { zh, en }

/**
 * 获取当前语言环境
 */
export function getLogLang() {
  const lang = (process.env.LOG_LANG || 'zh').toLowerCase().trim()
  return locales[lang] ? lang : 'zh'
}

/**
 * 翻译日志消息 key
 * @param {string} key - 消息键名
 * @returns {string} 翻译后的文本，如果 key 不存在则原样返回
 */
export function t(key) {
  const lang = getLogLang()
  return locales[lang]?.[key] || locales.zh?.[key] || key
}
