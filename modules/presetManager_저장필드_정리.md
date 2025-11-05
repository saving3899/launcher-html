# 프리셋에 저장되는 필드 목록

## 프리셋에 저장되지 않는 필드 (filterPresetSettings에서 제외)

### 1. 시스템/기술적 필드 (프리셋과 무관)
- `api_server`
- `preset`
- `streaming`
- `truncation_length`
- `n`
- `streaming_url`
- `stopping_strings`
- `can_use_tokenization`
- `can_use_streaming`
- `preset_settings_novel`
- `preset_settings`
- `streaming_novel`
- `nai_preamble`
- `model_novel`
- `streaming_kobold`
- `enabled`
- `bind_to_context`
- `seed`
- `legacy_api`
- `mancer_model`
- `togetherai_model`
- `ollama_model`
- `vllm_model`
- `aphrodite_model`
- `server_urls`
- `type`
- `custom_model`
- `bypass_status_check`
- `infermaticai_model`
- `dreamgen_model`
- `openrouter_model`
- `featherless_model`
- `max_tokens_second`
- `openrouter_providers`
- `openrouter_allow_fallbacks`
- `tabby_model`
- `derived`
- `generic_model`
- `include_reasoning`
- `global_banned_tokens`
- `send_banned_tokens`
- `auto_parse`
- `add_to_prompts`
- `auto_expand`
- `show_hidden`
- `max_additions`

### 2. 캐릭터/채팅/페르소나 관련 필드 (프리셋은 캐릭터와 무관)
- `currentCharacterId`
- `currentChatId`
- `currentPersonaId`
- `persona_description`
- `persona_description_position`

### 3. 사용자별 설정 필드 (프리셋과 무관)
- `play_message_sound` - 효과음 재생 설정
- `play_sound_unfocused` - 백그라운드 효과음 재생 설정
- `current_sound_id` - 현재 선택된 효과음 ID
- `message_send_key` - 메시지 전송 키보드 단축키 설정

## 프리셋에 저장되는 필드 (createDefaultPreset 기준)

### API Provider 및 모델 설정
- `chat_completion_source` - Chat Completion 소스 (예: 'openai')
- `openai_model` - OpenAI 모델
- `claude_model` - Claude 모델
- `openrouter_model` - OpenRouter 모델
- `openrouter_use_fallback` - OpenRouter 폴백 사용 여부
- `openrouter_group_models` - OpenRouter 모델 그룹화
- `openrouter_sort_models` - OpenRouter 모델 정렬 방식
- `ai21_model` - AI21 모델
- `mistralai_model` - Mistral AI 모델
- `electronhub_model` - ElectronHub 모델
- `electronhub_sort_models` - ElectronHub 모델 정렬
- `electronhub_group_models` - ElectronHub 모델 그룹화
- `custom_model` - 커스텀 모델
- `custom_url` - 커스텀 URL
- `custom_include_body` - 커스텀 요청 본문 포함 필드
- `custom_exclude_body` - 커스텀 요청 본문 제외 필드
- `custom_include_headers` - 커스텀 요청 헤더 포함 필드
- `google_model` - Google 모델
- `vertexai_model` - Vertex AI 모델

### 생성 파라미터
- `temperature` - 온도 (0~2)
- `frequency_penalty` - 빈도 패널티
- `presence_penalty` - 존재 패널티
- `top_p` - Top-p 샘플링
- `top_k` - Top-k 샘플링
- `top_a` - Top-a 샘플링
- `min_p` - Min-p 샘플링
- `repetition_penalty` - 반복 패널티
- `openai_max_context` - 최대 컨텍스트 크기
- `openai_max_tokens` - 최대 토큰 수

### 프롬프트 설정
- `wrap_in_quotes` - 따옴표로 감싸기
- `names_behavior` - 이름 동작 방식
- `send_if_empty` - 빈 값일 때 전송 여부
- `impersonation_prompt` - 가장하기 프롬프트
- `new_chat_prompt` - 새 채팅 프롬프트
- `new_group_chat_prompt` - 새 그룹 채팅 프롬프트
- `new_example_chat_prompt` - 새 예제 채팅 프롬프트
- `continue_nudge_prompt` - 계속하기 프롬프트
- `bias_preset_selected` - 선택된 편향 프리셋
- `group_nudge_prompt` - 그룹 프롬프트
- `wi_format` - World Info 형식
- `scenario_format` - 시나리오 형식
- `personality_format` - 성격 형식

### 프롬프트 템플릿
- `prompts` - 프롬프트 배열 (각 프롬프트는 name, identifier, content, role, system_prompt, marker 등의 속성을 가짐)
- `prompt_order` - 프롬프트 순서 배열 (character_id별로 order 배열을 가짐)

### 기타 설정
- `reverse_proxy` - 리버스 프록시 URL
- `proxy_password` - 프록시 비밀번호
- `max_context_unlocked` - 최대 컨텍스트 잠금 해제 여부
- `stream_openai` - OpenAI 스트리밍 사용 여부

## 효과음 설정 저장 확인

### 저장 위치
- **효과음 설정은 SettingsStorage에 직접 저장됨** (프리셋과 무관)
- `panel.js`의 `setupOtherSettingsPanelEvents`에서 효과음 셀렉트 변경 시:
  ```javascript
  settings.current_sound_id = selectedSoundId;
  await SettingsStorage.save(settings);
  ```

### 프리셋 적용 시 보호
- `applyPresetSettings`에서 효과음 설정을 명시적으로 유지:
  ```javascript
  if (restCurrentSettings.current_sound_id !== undefined) {
      mergedSettings.current_sound_id = restCurrentSettings.current_sound_id;
  }
  ```

### 저장 확인 방법
1. 효과음 설정 변경 → `SettingsStorage.save()` 호출 확인
2. 앱 재시작 → `SettingsStorage.load()`에서 `current_sound_id` 확인
3. 프리셋 변경 → 효과음 설정이 유지되는지 확인

