/**
 * 프롬프트 패널 생성 모듈 (Chat Completion Presets)
 */
async function createPromptsPanel() {
    const html = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>프롬프트 (Chat Completion Presets)</h2>
                <button class="close-panel-btn close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <section class="settings-section" id="openai_api-presets">
                    <div class="settings-section-header">
                        <h3>Chat Completion Presets</h3>
                        <div class="icon-btn-group">
                            <!-- Import 버튼 -->
                            <button id="import_oai_preset" class="icon-btn" title="프리셋 가져오기">
                                <i class="fa-solid fa-file-import"></i>
                            </button>
                            <!-- Export 버튼 -->
                            <button id="export_oai_preset" class="icon-btn" title="프리셋 내보내기">
                                <i class="fa-solid fa-file-export"></i>
                            </button>
                            <!-- Delete 버튼 -->
                            <button id="delete_oai_preset" class="icon-btn" title="프리셋 삭제">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="preset-select-group">
                            <!-- Preset 선택 드롭다운 -->
                            <select id="settings_preset_openai" class="text-input" data-preset-manager-for="openai">
                                <option value="gui">Default</option>
                            </select>
                            <!-- 숨김 파일 입력 (Import용) -->
                            <input id="openai_preset_import_file" type="file" accept=".json,.settings" hidden />
                            <!-- Update 버튼 -->
                            <button id="update_oai_preset" class="icon-btn" title="현재 프리셋 업데이트" data-preset-manager-update="openai">
                                <i class="fa-solid fa-save"></i>
                            </button>
                            <!-- Rename 버튼 -->
                            <button data-preset-manager-rename="openai" class="icon-btn" title="현재 프리셋 이름 변경">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <!-- Save as 버튼 -->
                            <button id="new_oai_preset" class="icon-btn" title="프리셋으로 저장" data-preset-manager-new="openai">
                                <i class="fa-solid fa-file-circle-plus"></i>
                            </button>
                        </div>
                    </div>
                </section>
                
                <!-- Quick Edit 섹션 -->
                <section class="settings-section">
                    <div class="collapsible-section">
                        <div class="collapsible-header">
                            <b>빠른 프롬프트 편집 (Quick Prompts Edit)</b>
                            <i class="fa-solid fa-chevron-down collapsible-icon"></i>
                        </div>
                        <div class="collapsible-content">
                            <div class="form-group">
                                <label for="main_prompt_quick_edit_textarea">
                                    <span>주요 (Main)</span>
                                </label>
                                <textarea id="main_prompt_quick_edit_textarea" 
                                          class="text-input" 
                                          rows="6" 
                                          placeholder="—" 
                                          data-pm-prompt="main"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="nsfw_prompt_quick_edit_textarea">
                                    <span>보조 (Auxiliary)</span>
                                </label>
                                <textarea id="nsfw_prompt_quick_edit_textarea" 
                                          class="text-input" 
                                          rows="6" 
                                          placeholder="—" 
                                          data-pm-prompt="nsfw"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="jailbreak_prompt_quick_edit_textarea">
                                    <span>이력 후 지침 (Post-History Instructions)</span>
                                </label>
                                <textarea id="jailbreak_prompt_quick_edit_textarea" 
                                          class="text-input" 
                                          rows="6" 
                                          placeholder="—" 
                                          data-pm-prompt="jailbreak"></textarea>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- Utility Prompts 섹션 -->
                <section class="settings-section">
                    <div class="collapsible-section">
                        <div class="collapsible-header">
                            <b>유틸리티 프롬프트 (Utility Prompts)</b>
                            <i class="fa-solid fa-chevron-down collapsible-icon"></i>
                        </div>
                        <div class="collapsible-content">
                            <!-- 사칭 프롬프트 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="impersonation_prompt_textarea">
                                        <span>사칭 프롬프트 (Impersonation prompt)</span>
                                    </label>
                                    <button id="impersonation_prompt_restore" class="icon-btn" title="기본 프롬프트 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    사칭 기능에 사용되는 프롬프트
                                </small>
                                <textarea id="impersonation_prompt_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 월드인포 형식 템플릿 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="wi_format_textarea">
                                        <span>월드 인포 형식 템플릿 (World Info Format Template)</span>
                                    </label>
                                    <button id="wi_format_restore" class="icon-btn" title="기본 형식 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    프롬프트에 삽입하기 전에 활성화된 월드 인포 항목을 래핑합니다. 사용 <code>{0}</code> 내용이 삽입된 위치를 표시합니다.
                                </small>
                                <textarea id="wi_format_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 월드인포 형식 템플릿 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="wi_format_textarea">
                                        <span>월드 인포 형식 템플릿 (World Info Format Template)</span>
                                    </label>
                                    <button id="wi_format_restore" class="icon-btn" title="기본 형식 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    프롬프트에 삽입하기 전에 활성화된 월드 인포 항목을 래핑합니다. 사용 <code>{0}</code> 내용이 삽입된 위치를 표시합니다.
                                </small>
                                <textarea id="wi_format_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 시나리오 형식 템플릿 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="scenario_format_textarea">
                                        <span>시나리오 형식 템플릿 (Scenario Format Template)</span>
                                    </label>
                                    <button id="scenario_format_restore" class="icon-btn" title="기본 형식 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    사용 <code>{{scenario}}</code> 내용이 삽입된 위치를 표시합니다.
                                </small>
                                <textarea id="scenario_format_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 성격 형식 템플릿 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="personality_format_textarea">
                                        <span>성격 형식 템플릿 (Personality Format Template)</span>
                                    </label>
                                    <button id="personality_format_restore" class="icon-btn" title="기본 형식 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    사용 <code>{{personality}}</code> 내용이 삽입된 위치를 표시합니다.
                                </small>
                                <textarea id="personality_format_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 그룹 너지 프롬프트 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="group_nudge_prompt_textarea">
                                        <span>그룹 너지 프롬프트 템플릿 (Group Nudge Prompt Template)</span>
                                    </label>
                                    <button id="group_nudge_prompt_restore" class="icon-btn" title="기본 형식 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    특정 캐릭터의 답장을 강제하기 위해 그룹 채팅 기록 마지막에 전송됩니다.
                                </small>
                                <textarea id="group_nudge_prompt_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 새 채팅 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="newchat_prompt_textarea">
                                        <span>새 채팅 (New Chat)</span>
                                    </label>
                                    <button id="newchat_prompt_restore" class="icon-btn" title="새 채팅 메시지 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    새 채팅이 곧 시작될 것임을 나타내기 위해 채팅 기록 시작 부분에 설정합니다.
                                </small>
                                <textarea id="newchat_prompt_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 새 그룹 채팅 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="newgroupchat_prompt_textarea">
                                        <span>새 그룹 채팅 (New Group Chat)</span>
                                    </label>
                                    <button id="newgroupchat_prompt_restore" class="icon-btn" title="기본 프롬프트 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    새 그룹 채팅이 곧 시작될 것임을 나타내기 위해 채팅 기록 시작 부분에 설정합니다.
                                </small>
                                <textarea id="newgroupchat_prompt_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 새로운 예시 채팅 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="newexamplechat_prompt_textarea">
                                        <span>새로운 예시 채팅 (New Example Chat)</span>
                                    </label>
                                    <button id="newexamplechat_prompt_restore" class="icon-btn" title="기본 프롬프트 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    새로운 예시 채팅이 곧 시작될 것임을 나타내기 위해 대화 예시의 시작 부분에 설정합니다.
                                </small>
                                <textarea id="newexamplechat_prompt_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 계속 넛지 -->
                            <div class="form-group">
                                <div class="form-group-header">
                                    <label for="continue_nudge_prompt_textarea">
                                        <span>계속 넛지 (Continue Nudge)</span>
                                    </label>
                                    <button id="continue_nudge_prompt_restore" class="icon-btn" title="새 채팅 메시지 복원">
                                        <i class="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                                <small class="text_muted">
                                    계속 버튼을 누르면 채팅 기록이 끝날 때 설정됩니다.
                                </small>
                                <textarea id="continue_nudge_prompt_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 빈 메시지 대체 -->
                            <div class="form-group">
                                <label for="send_if_empty_textarea">
                                    <span>빈 메시지 대체 (Replace Empty Message)</span>
                                </label>
                                <small class="text_muted">
                                    텍스트 상자가 비어 있을 때 이 텍스트를 아무것도 없이 보내세요.
                                </small>
                                <textarea id="send_if_empty_textarea" 
                                          class="text-input" 
                                          rows="3" 
                                          placeholder="—"></textarea>
                            </div>
                            
                            <!-- 시드 -->
                            <div class="form-group">
                                <label for="seed_openai">
                                    <span>시드 (Seed)</span>
                                </label>
                                <small class="text_muted">
                                    결정적인 결과를 얻으려면 설정하세요. 무작위 시드를 위해서는 -1 값을 사용합니다.
                                </small>
                                <input type="number" id="seed_openai" 
                                       class="text-input" 
                                       min="-1" 
                                       max="2147483647" 
                                       value="-1" />
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- Chat Settings -->
                <section class="settings-section" style="margin-top: var(--spacing-lg);">
                    <h3 style="margin: 0 0 var(--spacing-md) 0;">채팅 설정 (Chat Settings)</h3>
                    
                    <!-- Character Name Action -->
                    <div class="collapsible-section" style="margin-bottom: var(--spacing-md);">
                        <div class="collapsible-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md);">
                            <div class="flex-container" style="align-items: center; gap: var(--spacing-xs);">
                                <b>캐릭터 이름 동작 (Character Name Action)</b>
                                <i class="fa-solid fa-circle-info opacity50p" title="Helps the model to associate messages with characters."></i>
                                <small class="text_muted" id="character_names_display">(기본값)</small>
                            </div>
                            <i class="fa-solid fa-chevron-down collapsible-icon"></i>
                        </div>
                        <div class="collapsible-content" style="display: none; padding: var(--spacing-md);">
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="character_names_none">
                                <input type="radio" id="character_names_none" name="character_names" value="-1">
                                <span>없음 (None)</span>
                                <small class="text_muted" style="display: block; width: 100%; margin-left: 24px;">
                                    Never add character name prefixes. May behave poorly in groups, choose with caution.
                                </small>
                            </label>
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="character_names_default">
                                <input type="radio" id="character_names_default" name="character_names" value="0" checked>
                                <span>기본값 (Default)</span>
                                <small class="text_muted" style="display: block; width: 100%; margin-left: 24px;">
                                    Add prefixes for groups and past personas. Otherwise, make sure you provide names in the prompt.
                                </small>
                            </label>
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="character_names_completion">
                                <input type="radio" id="character_names_completion" name="character_names" value="1">
                                <span>Completion Object</span>
                                <small class="text_muted" style="display: block; width: 100%; margin-left: 24px;">
                                    Add character names to completion objects. Restrictions apply: only Latin alphanumerics and underscores.
                                </small>
                            </label>
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="character_names_content">
                                <input type="radio" id="character_names_content" name="character_names" value="2">
                                <span>Message Content</span>
                                <small class="text_muted" style="display: block; width: 100%; margin-left: 24px;">
                                    Prepend character names to message contents.
                                </small>
                            </label>
                            <input type="hidden" id="names_behavior" />
                        </div>
                    </div>
                    
                    <!-- Continue Postfix -->
                    <div class="collapsible-section" style="margin-bottom: var(--spacing-md);">
                        <div class="collapsible-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md);">
                            <div class="flex-container" style="align-items: center; gap: var(--spacing-xs);">
                                <b>계속하기 접미사 (Continue Postfix)</b>
                                <i class="fa-solid fa-circle-info opacity50p" title="The next chunk of the continued message will be appended using this as a separator."></i>
                                <small class="text_muted" id="continue_postfix_display">(없음)</small>
                            </div>
                            <i class="fa-solid fa-chevron-down collapsible-icon"></i>
                        </div>
                        <div class="collapsible-content" style="display: none; padding: var(--spacing-md);">
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="continue_postfix_none">
                                <input type="radio" id="continue_postfix_none" name="continue_postfix" value="0" checked>
                                <span>없음 (None)</span>
                            </label>
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="continue_postfix_space">
                                <input type="radio" id="continue_postfix_space" name="continue_postfix" value="1">
                                <span>공백 (Space)</span>
                            </label>
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="continue_postfix_newline">
                                <input type="radio" id="continue_postfix_newline" name="continue_postfix" value="2">
                                <span>새 줄 (Newline)</span>
                            </label>
                            <label class="checkbox_label flexWrap alignItemsCenter" style="margin-bottom: var(--spacing-sm);" for="continue_postfix_double_newline">
                                <input type="radio" id="continue_postfix_double_newline" name="continue_postfix" value="3">
                                <span>이중 줄 (Double Newline)</span>
                            </label>
                            <input type="hidden" id="continue_postfix" />
                        </div>
                    </div>
                    
                    <!-- Wrap in Quotes -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md);">
                        <label class="checkbox_label" for="wrap_in_quotes">
                            <input id="wrap_in_quotes" type="checkbox" />
                            <span>따옴표로 메시지 감싸기 (Wrap in Quotes)</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            사용자 메시지 전체를 보내기 전에 따옴표로 감싸집니다. 말하기 위해 수동으로 따옴표를 사용하는 경우 체크하지 마세요.
                        </small>
                    </div>
                    
                    <!-- Continue prefill -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md);">
                        <label class="checkbox_label" for="continue_prefill">
                            <input id="continue_prefill" type="checkbox" />
                            <span>사전 작성 계속 (Continue prefill)</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            계속하면 지시와 함께 시스템 메시지 대신 마지막 메시지를 어시스턴트 역할로 보냅니다.
                        </small>
                    </div>
                    
                    <!-- Compress system messages -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md);">
                        <label class="checkbox_label" for="squash_system_messages">
                            <input id="squash_system_messages" type="checkbox" />
                            <span>시스템 메시지 압축 (Compress system messages)</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            연속된 시스템 메시지를 하나로 결합합니다(예제 대화 제외). 일부 모델의 일관성을 향상시킬 수 있습니다.
                        </small>
                    </div>
                    
                    <!-- Enable web search -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="makersuite,vertexai,aimlapi,openrouter,claude,xai,electronhub,nanogpt">
                        <label class="checkbox_label" for="openai_enable_web_search">
                            <input id="openai_enable_web_search" type="checkbox" />
                            <span>웹 검색 활성화</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            백엔드에서 제공하는 검색 기능을 사용합니다.
                        </small>
                    </div>
                    
                    <!-- Enable function calling -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="openai,cohere,mistralai,custom,claude,aimlapi,openrouter,groq,deepseek,makersuite,vertexai,ai21,xai,pollinations,moonshot,fireworks,cometapi,electronhub,azure_openai,zai">
                        <label class="checkbox_label" for="openai_function_calling">
                            <input id="openai_function_calling" type="checkbox" />
                            <span>함수 호출 활성화 (Enable function calling)</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            다양한 확장 프로그램에서 추가 기능을 제공하기 위한 기능 도구를 사용할 수 있게 합니다. "no tools"를 사용한 프롬프트 후처리와 함께 사용할 수 없습니다!
                        </small>
                    </div>
                    
                    <!-- Send inline images -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="openai,aimlapi,openrouter,mistralai,makersuite,vertexai,claude,custom,xai,pollinations,moonshot,cohere,cometapi,nanogpt,electronhub,azure_openai,zai">
                        <label class="checkbox_label" for="openai_image_inlining">
                            <input id="openai_image_inlining" type="checkbox" />
                            <span>인라인 이미지 전송 (Send inline images)</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            모델이 지원하는 경우 메시지로 이미지를 보냅니다. 사용 📎 메시지에 대한 조치 또는 ✂️ 채팅에 이미지 파일을 첨부하는 메뉴입니다.
                        </small>
                    </div>
                    
                    <!-- Send inline videos -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="makersuite,vertexai">
                        <label class="checkbox_label" for="openai_video_inlining">
                            <input id="openai_video_inlining" type="checkbox" />
                            <span>인라인 비디오 전송</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            모델이 지원하는 경우 프롬프트에 비디오를 전송합니다. 메시지의 📎 작업이나 ✂️ 메뉴를 사용하여 채팅에 비디오 파일을 첨부할 수 있습니다. 비디오는 20MB 미만이며 1분 이하여야 합니다.
                        </small>
                    </div>
                    
                    <!-- Request inline images -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="makersuite,vertexai">
                        <label class="checkbox_label" for="openai_request_images">
                            <input id="openai_request_images" type="checkbox" />
                            <span>인라인 이미지 요청</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            모델이 이미지 첨부 파일을 반환할 수 있게 합니다. 다음 기능과 호환되지 않습니다: 함수 호출, 웹 검색, 시스템 프롬프트.
                        </small>
                    </div>
                    
                    <!-- Use system prompt -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="makersuite,vertexai">
                        <label class="checkbox_label" for="use_makersuite_sysprompt">
                            <input id="use_makersuite_sysprompt" type="checkbox" />
                            <span>시스템 프롬프트 사용 (Use system prompt)</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            비시스템 역할이 있는 첫 번째 메시지까지 모든 시스템 메시지를 병합하여 system_instruction 필드에 보냅니다.
                        </small>
                    </div>
                    
                    <!-- Request model reasoning -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="deepseek,aimlapi,openrouter,custom,claude,xai,makersuite,vertexai,pollinations,moonshot,mistralai,fireworks,cometapi,electronhub,azure_openai,nanogpt,zai">
                        <label class="checkbox_label" for="openai_show_thoughts">
                            <input id="openai_show_thoughts" type="checkbox" />
                            <span>모델 추론 요청</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            모델이 자신의 사고 과정을 반환할 수 있게 합니다. 이 설정은 표시 여부에만 영향을 줍니다.
                        </small>
                    </div>
                    
                    <!-- Reasoning Effort -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md); display: none;" data-source="openai,custom,claude,xai,makersuite,vertexai,aimlapi,openrouter,pollinations,perplexity,cometapi,electronhub,azure_openai">
                        <label for="openai_reasoning_effort">
                            <span>추론 노력</span>
                            <a href="https://docs.sillytavern.app/usage/prompts/reasoning/#reasoning-effort" target="_blank" class="opacity50p fa-solid fa-circle-question" style="margin-left: var(--spacing-xs);"></a>
                        </label>
                        <select id="openai_reasoning_effort" class="text-input" style="width: 100%; margin-top: var(--spacing-xs);">
                            <option value="auto">Auto</option>
                            <option value="min">Minimum</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high" selected>High</option>
                            <option value="max">Maximum</option>
                        </select>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);" data-source="openai,custom,xai,aimlapi,openrouter,perplexity,electronhub,azure_openai">
                            OpenAI 스타일 옵션: low, medium, high. Minimum과 maximum은 low와 high의 별칭입니다. Auto는 노력 수준을 전송하지 않습니다.
                        </small>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);" data-source="claude">
                            사고를 위해 응답 길이의 일부를 할당합니다 (min: 1024 토큰, low: 10%, medium: 25%, high: 50%, max: 95%), 최소 1024 토큰입니다. Auto는 사고를 요청하지 않습니다.
                        </small>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);" data-source="makersuite,vertexai">
                            사고를 위해 응답 길이의 일부를 할당합니다 (Flash 2.5/Pro 2.5) (min: 0/128 토큰, low: 10%, medium: 25%, high: 50%, max: 24576/32768 토큰). Auto는 모델이 결정하도록 합니다.
                        </small>
                    </div>
                </section>
                
                <!-- Generation Settings -->
                <section class="settings-section" style="margin-top: var(--spacing-lg);">
                    <h3 style="margin: 0 0 var(--spacing-md) 0;">생성 설정 (Generation Settings)</h3>
                    
                    <!-- 컨텍스트 크기 잠금 해제 -->
                    <div class="form-group" style="margin-bottom: var(--spacing-md);">
                        <label class="checkbox_label">
                            <input type="checkbox" id="oai_max_context_unlocked" />
                            <span>잠금 해제된 컨텍스트 크기</span>
                        </label>
                        <small class="text_muted" style="display: block; margin-top: var(--spacing-xs);">
                            컨텍스트 슬라이더에 대한 제한 없는 최대값. 모델이 8192 토큰보다 큰 컨텍스트 크기를 지원하는 경우에만 활성화하세요.
                        </small>
                    </div>
                    
                    <!-- 컨텍스트 크기 및 응답 길이 -->
                    <div class="flex-container" style="gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
                        <div class="form-group flex1">
                            <label for="openai_max_context_counter">
                                <span>컨텍스트 크기 (토큰)</span>
                            </label>
                            <div class="range-container">
                                <input type="range" id="openai_max_context" min="512" max="4095" step="1" value="4095" />
                                <input type="number" id="openai_max_context_counter" min="512" max="4095" step="1" value="4095" class="text-input" />
                            </div>
                        </div>
                        
                        <div class="form-group flex1">
                            <label for="openai_max_tokens">
                                <span>최대 응답 길이 (토큰)</span>
                            </label>
                            <input type="number" id="openai_max_tokens" min="1" max="65536" step="1" value="300" class="text-input" />
                        </div>
                    </div>
                    
                    <!-- 스트리밍 -->
                    <div class="form-group">
                        <label class="checkbox_label">
                            <input type="checkbox" id="stream_toggle" checked />
                            <span>스트리밍</span>
                        </label>
                        <small class="text_muted">
                            생성되는 대답을 조금씩 표시합니다. 이 기능이 꺼져 있으면 대답은 완료되면 한 번에 모두 표시됩니다.
                        </small>
                    </div>
                    
                    <hr />
                    
                    <!-- 샘플링 파라미터 -->
                    <h4>샘플링 파라미터</h4>
                    
                    <div class="sampling-params-grid">
                        <!-- 온도 -->
                        <!-- Temperature: openai,claude,aimlapi,openrouter,ai21,makersuite,vertexai,mistralai,custom,cohere,perplexity,groq,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai,zai -->
                        <div class="form-group" data-source="openai,claude,aimlapi,openrouter,ai21,makersuite,vertexai,mistralai,custom,cohere,perplexity,groq,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai,zai">
                            <label for="temp_counter_openai">
                                <span>온도</span>
                            </label>
                            <div class="range-container">
                                <input type="range" id="temp_openai" min="0" max="2.0" step="0.01" value="1" />
                                <input type="number" id="temp_counter_openai" min="0" max="2.0" step="0.01" value="1" class="text-input" />
                            </div>
                        </div>
                        
                        <!-- Frequency Penalty -->
                        <!-- Frequency Penalty: openai,aimlapi,openrouter,custom,cohere,perplexity,groq,mistralai,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai -->
                        <div class="form-group" style="display: none;" data-source="openai,aimlapi,openrouter,custom,cohere,perplexity,groq,mistralai,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai">
                            <label for="freq_pen_counter_openai">
                                <span>빈도 패널티</span>
                            </label>
                            <div class="range-container">
                                <input type="range" id="freq_pen_openai" min="-2" max="2" step="0.01" value="0" />
                                <input type="number" id="freq_pen_counter_openai" min="-2" max="2" step="0.01" value="0" class="text-input" />
                            </div>
                        </div>
                        
                        <!-- Presence Penalty -->
                        <!-- Presence Penalty: openai,aimlapi,openrouter,custom,cohere,perplexity,groq,mistralai,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai -->
                        <div class="form-group" style="display: none;" data-source="openai,aimlapi,openrouter,custom,cohere,perplexity,groq,mistralai,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai">
                            <label for="pres_pen_counter_openai">
                                <span>존재 패널티</span>
                            </label>
                            <div class="range-container">
                                <input type="range" id="pres_pen_openai" min="-2" max="2" step="0.01" value="0" />
                                <input type="number" id="pres_pen_counter_openai" min="-2" max="2" step="0.01" value="0" class="text-input" />
                            </div>
                        </div>
                        
                        <!-- Top K -->
                        <!-- Top K: claude,aimlapi,openrouter,makersuite,vertexai,cohere,perplexity,electronhub -->
                        <div class="form-group" style="display: none;" data-source="claude,aimlapi,openrouter,makersuite,vertexai,cohere,perplexity,electronhub">
                            <label for="top_k_counter_openai">
                                <span>상위 K</span>
                            </label>
                            <div class="range-container">
                                <input type="range" id="top_k_openai" min="0" max="500" step="1" value="0" />
                                <input type="number" id="top_k_counter_openai" min="0" max="500" step="1" value="0" class="text-input" />
                            </div>
                        </div>
                        
                        <!-- Top P -->
                        <!-- Top P: openai,claude,aimlapi,openrouter,ai21,makersuite,vertexai,mistralai,custom,cohere,perplexity,groq,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai,zai -->
                        <div class="form-group" data-source="openai,claude,aimlapi,openrouter,ai21,makersuite,vertexai,mistralai,custom,cohere,perplexity,groq,electronhub,nanogpt,deepseek,xai,pollinations,moonshot,fireworks,cometapi,azure_openai,zai">
                            <label for="top_p_counter_openai">
                                <span>상위 P</span>
                            </label>
                            <div class="range-container">
                                <input type="range" id="top_p_openai" min="0" max="1" step="0.01" value="1" />
                                <input type="number" id="top_p_counter_openai" min="0" max="1" step="0.01" value="1" class="text-input" />
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- 프롬프트 관리 UI -->
                <section class="settings-section">
                    <h3>프롬프트 관리</h3>
                    
                    <!-- 프롬프트 매니저 컨테이너 -->
                    <div id="completion_prompt_manager" class="prompt-manager-container">
                        <!-- 헤더는 동적으로 생성됨 -->
                        <!-- 리스트는 동적으로 생성됨 -->
                        <!-- 푸터는 동적으로 생성됨 -->
                    </div>
                </section>
            </div>
        </div>
        
        <!-- 프롬프트 편집 팝업 (전역 팝업) -->
        <div id="completion_prompt_manager_popup" class="modal" style="display: none;">
            <div class="modal-content">
                <!-- 검사 (Inspect) 영역 -->
                <div id="completion_prompt_manager_popup_inspect" style="display: none;">
                    <h3>Inspect</h3>
                    <div class="completion_prompt_manager_popup_entry">
                        <form class="completion_prompt_manager_popup_entry_form">
                            <div class="completion_prompt_manager_popup_entry_form_control">
                                <div class="completion_prompt_manager_popup_header">
                                    <label for="completion_prompt_manager_popup_entry_form_prompt">
                                        <span>Prompt List</span>
                                    </label>
                                    <button id="completion_prompt_manager_popup_close_button" class="close-btn">&times;</button>
                                </div>
                                <div class="text_muted">
                                    The list of prompts associated with this marker.
                                </div>
                                <div id="completion_prompt_manager_popup_entry_form_inspect_list"></div>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- 편집 (Edit) 영역 -->
                <div id="completion_prompt_manager_popup_edit" style="display: none;">
                    <h3>Edit</h3>
                    <div class="completion_prompt_manager_popup_entry">
                        <form class="completion_prompt_manager_popup_entry_form">
                            <!-- 첫 번째 행: Name, Role -->
                            <div class="completion_prompt_manager_popup_entry_form_control flex-container">
                            <!-- 이름 -->
                            <div class="completion_prompt_manager_popup_entry_form_control flex1">
                                <label for="completion_prompt_manager_popup_entry_form_name">
                                    <span>Name</span>
                                </label>
                                <input id="completion_prompt_manager_popup_entry_form_name" 
                                       class="text-input" type="text" name="name" />
                            </div>
                            
                            <!-- 역할 -->
                            <div class="completion_prompt_manager_popup_entry_form_control flex1">
                                <label for="completion_prompt_manager_popup_entry_form_role">
                                    <span>Role</span>
                                </label>
                                <select id="completion_prompt_manager_popup_entry_form_role" 
                                        class="text-input" name="role">
                                    <option value="system">System</option>
                                    <option value="user">User</option>
                                    <option value="assistant">AI Assistant</option>
                                </select>
                            </div>
                            </div>
                            
                            <!-- 두 번째 행: Triggers, Position -->
                            <div class="completion_prompt_manager_popup_entry_form_control flex-container">
                            <!-- 트리거 -->
                            <div class="completion_prompt_manager_popup_entry_form_control flex1">
                                <label for="completion_prompt_manager_popup_entry_form_injection_trigger">
                                    <span>Triggers</span>
                                </label>
                                <select id="completion_prompt_manager_popup_entry_form_injection_trigger" 
                                        class="text-input" name="injection_trigger" multiple>
                                    <option value="normal">Normal</option>
                                    <option value="continue">Continue</option>
                                    <option value="impersonate">Impersonate</option>
                                    <option value="swipe">Swipe</option>
                                    <option value="regenerate">Regenerate</option>
                                    <option value="quiet">Quiet</option>
                                </select>
                            </div>
                            
                            <!-- 위치 -->
                            <div class="completion_prompt_manager_popup_entry_form_control flex1">
                                <label for="completion_prompt_manager_popup_entry_form_injection_position">
                                    <span>Position</span>
                                </label>
                                <select id="completion_prompt_manager_popup_entry_form_injection_position" 
                                        class="text_pole" name="injection_position">
                                    <option value="0">Relative</option>
                                    <option value="1">In-chat</option>
                                </select>
                            </div>
                            </div>
                            
                            <!-- 세 번째 행: Depth, Order (절대 위치일 때만 표시) -->
                            <div id="completion_prompt_manager_depth_order_row" class="completion_prompt_manager_popup_entry_form_control flex-container" style="display: none;">
                            <!-- 깊이 (절대 위치일 때만 표시) -->
                            <div id="completion_prompt_manager_depth_block" 
                                 class="completion_prompt_manager_popup_entry_form_control flex1">
                                <label for="completion_prompt_manager_popup_entry_form_injection_depth">
                                    <span>Depth</span>
                                </label>
                                <input id="completion_prompt_manager_popup_entry_form_injection_depth" 
                                       class="text-input" type="number" 
                                       name="injection_depth" min="0" max="9999" value="4" />
                            </div>
                            
                            <!-- 순서 (절대 위치일 때만 표시) -->
                            <div id="completion_prompt_manager_order_block" 
                                 class="completion_prompt_manager_popup_entry_form_control flex1">
                                <label for="completion_prompt_manager_popup_entry_form_injection_order">
                                    <span>Order</span>
                                </label>
                                <input id="completion_prompt_manager_popup_entry_form_injection_order" 
                                       class="text-input" type="number" 
                                       name="injection_order" min="0" max="9999" value="100" />
                            </div>
                            </div>
                            
                            <!-- 프롬프트 내용 -->
                            <div class="completion_prompt_manager_popup_entry_form_control">
                                <div class="flex-container" style="align-items: center; justify-content: space-between;">
                                    <label for="completion_prompt_manager_popup_entry_form_prompt">
                                        <span>Prompt</span>
                                    </label>
                                    <!-- 오버라이드 금지 체크박스 -->
                                    <div id="completion_prompt_manager_forbid_overrides_block">
                                        <label class="checkbox_label" 
                                               for="completion_prompt_manager_popup_entry_form_forbid_overrides">
                                            <input type="checkbox" 
                                                   id="completion_prompt_manager_popup_entry_form_forbid_overrides" 
                                                   name="forbid_overrides" />
                                            <span>Forbid Overrides</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <!-- 프롬프트 소스 표시 (자동 생성 프롬프트일 때) -->
                                <div id="completion_prompt_manager_popup_entry_source_block" style="display: none;">
                                    <small class="text_muted">
                                        <span>Source:</span>
                                        <span id="completion_prompt_manager_popup_entry_source"></span>
                                    </small>
                                </div>
                                
                                <textarea id="completion_prompt_manager_popup_entry_form_prompt" 
                                          class="text-input" 
                                          name="prompt" 
                                          rows="6"
                                          placeholder="The prompt to be sent."></textarea>
                            </div>
                            
                            <!-- 버튼들 -->
                            <div class="completion_prompt_manager_popup_entry_form_footer">
                                <button id="completion_prompt_manager_popup_entry_form_save" 
                                        type="button"
                                        class="btn" 
                                        data-pm-prompt="">
                                    Save
                                </button>
                                <button id="completion_prompt_manager_popup_entry_form_reset" 
                                        type="button"
                                        class="btn btn-secondary" 
                                        data-pm-prompt="" 
                                        style="display:none;">
                                    Reset
                                </button>
                                <button id="completion_prompt_manager_popup_entry_form_close" 
                                        type="button"
                                        class="btn btn-secondary">
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

/**
 * 템플릿 패널 생성 모듈 (컨텍스트 템플릿, 지시 템플릿, 시스템 프롬프트)
 */
async function createTemplatesPanel() {
    const html = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>템플릿</h2>
                <button class="close-panel-btn close-btn">&times;</button>
            </div>
            <div class="modal-body" style="padding: var(--spacing-md);">
                <section class="settings-section">
                    <h3>템플릿 관리</h3>
                    <div class="info-block hint">
                        <small>컨텍스트 템플릿, 지시 템플릿, 시스템 프롬프트 관리 기능은 추후 구현 예정입니다.</small>
                    </div>
                </section>
            </div>
        </div>
    `;
    
    return html;
}

/**
 * 접기/펼치기 섹션 토글
 */
function setupCollapsibleSections(panelContainer) {
    const headers = panelContainer.querySelectorAll('.collapsible-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.collapsible-icon');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                if (icon) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            } else {
                content.style.display = 'none';
                if (icon) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
        });
    });
}

/**
 * API별 필드명 매핑
 * 실리태번과 동일한 필드명 사용
 */
function getApiFieldMapping(apiProvider) {
    // OpenAI 계열 (openai, claude, openrouter, 등 Chat Completion API)
    const chatCompletionApis = ['openai', 'claude', 'openrouter', 'ai21', 'makersuite', 'vertexai', 
                                 'mistralai', 'custom', 'cohere', 'perplexity', 'groq', 'electronhub', 
                                 'nanogpt', 'deepseek', 'xai', 'pollinations', 'moonshot', 'fireworks', 
                                 'cometapi', 'azure_openai', 'zai'];
    
    if (chatCompletionApis.includes(apiProvider)) {
        return {
            contextField: 'openai_max_context',
            contextCounterField: 'openai_max_context_counter',
            contextSliderField: 'openai_max_context',
            maxTokensField: 'openai_max_tokens',
            contextUnlockedField: 'oai_max_context_unlocked',
            streamField: 'stream_toggle',
            // 기본값들
            defaultContext: 4095,
            defaultMaxTokens: 300,
            defaultContextMin: 512,
            defaultContextMax: 4095,
        };
    }
    
    // Text Generation API 계열 (kobold, textgenerationwebui, novel)
    // 현재는 OpenAI 필드명을 사용 (나중에 확장 가능)
    return {
        contextField: 'openai_max_context',
        contextCounterField: 'openai_max_context_counter',
        contextSliderField: 'openai_max_context',
        maxTokensField: 'openai_max_tokens',
        contextUnlockedField: 'oai_max_context_unlocked',
        streamField: 'stream_toggle',
        defaultContext: 4095,
        defaultMaxTokens: 300,
        defaultContextMin: 512,
        defaultContextMax: 4095,
    };
}

/**
 * 모델별 최대 컨텍스트 크기 계산 (OpenAI 계열)
 * 실리태번의 getMaxContextOpenAI 함수와 동일한 로직
 */
function getMaxContextForModel(model, apiProvider, isUnlocked) {
    // 잠금 해제된 경우 매우 큰 값 반환 (실리태번의 unlocked_max 상수)
    // 실리태번: unlocked_max = max_2mil = 2000 * 1000 = 2,000,000
    const unlocked_max = 2000000; // 실리태번의 unlocked_max 상수값 (max_2mil)
    
    // 잠금 해제된 경우 unlocked_max 반환 (모델 제한 무시)
    if (isUnlocked) {
        return unlocked_max;
    }
    
    // 잠금 해제되지 않은 경우 모델별 최대값 반환
    
    // OpenAI 모델별 최대값
    if (apiProvider === 'openai' || apiProvider === 'custom' || apiProvider === 'azure_openai') {
        if (model?.startsWith('gpt-5')) {
            return 400000; // max_400k
        } else if (model?.includes('gpt-4.1')) {
            return 1000000; // max_1mil
        } else if (model?.startsWith('o1')) {
            return 128000; // max_128k
        } else if (model?.startsWith('o4') || model?.startsWith('o3')) {
            return 200000; // max_200k
        } else if (model?.includes('chatgpt-4o-latest') || model?.includes('gpt-4-turbo') || 
                   model?.includes('gpt-4o') || model?.includes('gpt-4-1106') || 
                   model?.includes('gpt-4-0125') || model?.includes('gpt-4-vision')) {
            return 128000; // max_128k
        } else if (model?.includes('gpt-3.5-turbo-1106')) {
            return 16000; // max_16k
        } else if (['gpt-4', 'gpt-4-0314', 'gpt-4-0613'].includes(model)) {
            return 8000; // max_8k
        } else if (['gpt-4-32k', 'gpt-4-32k-0314', 'gpt-4-32k-0613'].includes(model)) {
            return 32000; // max_32k
        } else if (['gpt-3.5-turbo-16k', 'gpt-3.5-turbo-16k-0613'].includes(model)) {
            return 16000; // max_16k
        } else if (model === 'code-davinci-002') {
            return 8000; // max_8k
        } else if (['text-curie-001', 'text-babbage-001', 'text-ada-001'].includes(model)) {
            return 2000; // max_2k
        } else {
            // 기본값: GPT-3 (4095 토큰)
            return 4095; // max_4k
        }
    }
    
    // Google Vertex AI / MakerSuite 모델
    if (apiProvider === 'vertexai' || apiProvider === 'makersuite') {
        if (model?.includes('gemini-2.5-flash-image')) {
            return 32000; // max_32k
        } else if (model?.includes('gemini-2.0-flash') || model?.includes('gemini-2.0-pro') || 
                   model?.includes('gemini-exp') || model?.includes('gemini-2.5-flash') || 
                   model?.includes('gemini-2.5-pro') || model?.includes('learnlm-2.0-flash') || 
                   model?.includes('gemini-robotics')) {
            return 1000000; // max_1mil
        } else if (model?.includes('gemma-3-27b-it')) {
            return 128000; // max_128k
        } else if (model?.includes('gemma-3n-e4b-it')) {
            return 8000; // max_8k
        } else if (model?.includes('gemma-3')) {
            return 32000; // max_32k
        } else {
            return 32000; // 기본값
        }
    }
    
    // Mistral AI 모델
    if (apiProvider === 'mistralai') {
        // 기본값 32k (실제로는 모델별로 다를 수 있음)
        return 32000;
    }
    
    // Groq 모델
    if (apiProvider === 'groq') {
        // 기본값 128k (실제로는 모델별로 다를 수 있음)
        return 128000;
    }
    
    // 기본값
    return 4095;
}

/**
 * 모델 변경 핸들러
 * 실리태번의 onModelChange와 유사한 로직
 */
async function handleModelChange(panelContainer, apiProvider) {
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // 현재 선택된 모델 가져오기
    const modelSelectId = `model_${apiProvider}_select`;
    const modelSelect = document.getElementById(modelSelectId);
    if (!modelSelect) {
        return; // 모델 선택 요소가 없으면 무시
    }
    
    const selectedModel = modelSelect.value;
    if (!selectedModel) {
        return;
    }
    
    // 컨텍스트 잠금 해제 상태 확인
    const fieldMapping = getApiFieldMapping(apiProvider);
    const contextUnlocked = panelContainer.querySelector(`#${fieldMapping.contextUnlockedField}`);
    const isUnlocked = contextUnlocked ? contextUnlocked.checked : false;
    
    // 최대 컨텍스트 크기 계산
    const maxContext = getMaxContextForModel(selectedModel, apiProvider, isUnlocked);
    
    // UI 업데이트
    const contextSlider = panelContainer.querySelector(`#${fieldMapping.contextSliderField}`);
    const contextCounter = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
    
    if (contextSlider && contextCounter) {
        // max 속성 업데이트
        contextSlider.setAttribute('max', maxContext);
        contextCounter.setAttribute('max', maxContext);
        
        // 현재 값이 최대값을 초과하면 제한
        const currentValue = parseInt(contextCounter.value) || fieldMapping.defaultContext;
        if (currentValue > maxContext) {
            contextSlider.value = maxContext;
            contextCounter.value = maxContext;
            // 설정 저장 (apiProvider 보존)
            const updatedSettings = await SettingsStorage.load();
            const preservedApiProvider = updatedSettings.apiProvider;
            const preservedApiKeys = updatedSettings.apiKeys || {};
            const preservedApiModels = updatedSettings.apiModels || {};
            updatedSettings[fieldMapping.contextField] = maxContext;
            // apiProvider, apiKeys, apiModels 보존
            updatedSettings.apiProvider = preservedApiProvider;
            updatedSettings.apiKeys = { ...preservedApiKeys };
            updatedSettings.apiModels = { ...preservedApiModels };
            await SettingsStorage.save(updatedSettings);
        }
    }
    
    // Google Vertex AI / MakerSuite 모델의 경우 온도 제한 적용
    if (apiProvider === 'vertexai' || apiProvider === 'makersuite') {
        // vision/ultra/gemma 모델은 최대 온도 1.0, 나머지는 2.0
        const maxTemp = (selectedModel.includes('vision') || selectedModel.includes('ultra') || selectedModel.includes('gemma')) ? 1.0 : 2.0;
        
        const tempSlider = panelContainer.querySelector('#temp_openai');
        const tempCounter = panelContainer.querySelector('#temp_counter_openai');
        
        if (tempSlider && tempCounter) {
            // 온도 슬라이더의 max 속성 업데이트
            tempSlider.setAttribute('max', maxTemp);
            tempCounter.setAttribute('max', maxTemp);
            
            // 현재 온도 값이 최대값을 초과하면 제한
            const currentTemp = parseFloat(tempCounter.value) || 1.0;
            if (currentTemp > maxTemp) {
                tempSlider.value = maxTemp;
                tempCounter.value = maxTemp.toFixed(2);
                
                // 설정 저장
                const updatedSettings = await SettingsStorage.load();
                const preservedApiProvider = updatedSettings.apiProvider;
                const preservedApiKeys = updatedSettings.apiKeys || {};
                const preservedApiModels = updatedSettings.apiModels || {};
                updatedSettings.temperature = maxTemp;
                updatedSettings.temp_openai = maxTemp;
                // apiProvider, apiKeys, apiModels 보존
                updatedSettings.apiProvider = preservedApiProvider;
                updatedSettings.apiKeys = { ...preservedApiKeys };
                updatedSettings.apiModels = { ...preservedApiModels };
                await SettingsStorage.save(updatedSettings);
                
                // 슬라이더 이벤트 트리거하여 UI 동기화
                tempSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
}

/**
 * 슬라이더와 숫자 입력 동기화
 * number 인풋은 focus 상태에서 자유롭게 입력 가능하고, blur 시 range 제한 적용
 */
function setupSliderSync(panelContainer) {
    /**
     * number 인풋과 range 슬라이더를 동기화하는 헬퍼 함수
     * @param {HTMLElement} slider - range 슬라이더 요소
     * @param {HTMLElement} counter - number 인풋 요소
     * @param {boolean} isFloat - 소수점 값인지 여부 (소수점이면 .toFixed(2) 적용)
     */
    const syncSliderAndCounter = (slider, counter, isFloat = false) => {
        if (!slider || !counter) return;
        
        // 슬라이더 변경 시 -> number 인풋 업데이트
        slider.addEventListener('input', (e) => {
            if (isFloat) {
                counter.value = parseFloat(e.target.value).toFixed(2);
            } else {
                counter.value = e.target.value;
            }
        });
        
        // number 인풋 focus 시 -> 제한 없이 입력 가능하도록 (이벤트만 제거)
        // number 인풋 blur 시 -> range 제한 적용 및 슬라이더 동기화
        counter.addEventListener('blur', (e) => {
            const inputValue = e.target.value;
            let processedValue;
            
            if (isFloat) {
                const numValue = parseFloat(inputValue) || 0;
                processedValue = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), numValue));
                // 소수점 처리
                processedValue = parseFloat(processedValue.toFixed(2));
                counter.value = processedValue.toFixed(2);
            } else {
                const numValue = parseInt(inputValue) || 0;
                processedValue = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), numValue));
                counter.value = processedValue;
            }
            
            // 슬라이더도 업데이트
            slider.value = processedValue;
            
            // change 이벤트를 트리거하여 저장 함수 호출
            counter.dispatchEvent(new Event('change', { bubbles: true }));
        });
    };
    
    // 컨텍스트 크기
    const maxContextSlider = panelContainer.querySelector('#openai_max_context');
    const maxContextCounter = panelContainer.querySelector('#openai_max_context_counter');
    syncSliderAndCounter(maxContextSlider, maxContextCounter, false);
    
    // 온도
    const tempSlider = panelContainer.querySelector('#temp_openai');
    const tempCounter = panelContainer.querySelector('#temp_counter_openai');
    syncSliderAndCounter(tempSlider, tempCounter, true);
    
    // Frequency Penalty
    const freqPenSlider = panelContainer.querySelector('#freq_pen_openai');
    const freqPenCounter = panelContainer.querySelector('#freq_pen_counter_openai');
    syncSliderAndCounter(freqPenSlider, freqPenCounter, true);
    
    // Presence Penalty
    const presPenSlider = panelContainer.querySelector('#pres_pen_openai');
    const presPenCounter = panelContainer.querySelector('#pres_pen_counter_openai');
    syncSliderAndCounter(presPenSlider, presPenCounter, true);
    
    // Top K
    const topKSlider = panelContainer.querySelector('#top_k_openai');
    const topKCounter = panelContainer.querySelector('#top_k_counter_openai');
    syncSliderAndCounter(topKSlider, topKCounter, false);
    
    // Top P
    const topPSlider = panelContainer.querySelector('#top_p_openai');
    const topPCounter = panelContainer.querySelector('#top_p_counter_openai');
    syncSliderAndCounter(topPSlider, topPCounter, true);
    
    // API별 동적 필드들도 처리 (data-source 속성을 가진 모든 number 인풋)
    const dynamicNumberInputs = panelContainer.querySelectorAll('input[type="number"][data-source]');
    dynamicNumberInputs.forEach((counter) => {
        // 같은 id 패턴의 슬라이더 찾기 (예: openai_max_context_counter -> openai_max_context)
        const sliderId = counter.id.replace(/_counter/, '');
        const slider = panelContainer.querySelector(`#${sliderId}`);
        if (slider && slider.type === 'range') {
            // 소수점 필드인지 확인 (step이 0.01이거나 id에 'temp', 'pen', 'top_p' 등이 포함된 경우)
            const isFloatField = counter.step === '0.01' || 
                                counter.id.includes('temp') || 
                                counter.id.includes('pen') || 
                                counter.id.includes('top_p');
            syncSliderAndCounter(slider, counter, isFloatField);
        }
    });
}

/**
 * 프롬프트 패널 이벤트 설정
 */
/**
 * UI 필드에 설정 로드
 * @param {HTMLElement} panelContainer - 패널 컨테이너
 * @param {string} [apiProvider] - API Provider (선택적, 없으면 자동 감지)
 */
async function loadGenerationSettings(panelContainer, apiProvider = null) {
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // API Provider 확인 (매개변수 > 설정 모달 select > SettingsStorage 순서로 우선순위)
    if (!apiProvider) {
        // 설정 모달의 select에서 먼저 확인 (더 최신일 수 있음)
        const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
        if (chatCompletionSourceSelect && chatCompletionSourceSelect.value) {
            apiProvider = chatCompletionSourceSelect.value;
        } else {
            // SettingsStorage에서 확인
            apiProvider = settings.apiProvider || 'openai';
        }
    }
    
    const fieldMapping = getApiFieldMapping(apiProvider);
    
    // 현재 선택된 모델 확인 (모델 변경 시 컨텍스트 크기 최대값 조정용)
    const modelSelectId = `model_${apiProvider}_select`;
    const modelSelect = document.getElementById(modelSelectId);
    const selectedModel = modelSelect?.value || '';
    
    // 컨텍스트 크기 잠금 해제
    const maxContextUnlocked = panelContainer.querySelector(`#${fieldMapping.contextUnlockedField}`);
    if (maxContextUnlocked) {
        const unlockedValue = settings.max_context_unlocked || 
                             settings.oai_max_context_unlocked || 
                             settings[fieldMapping.contextUnlockedField] || false;
        maxContextUnlocked.checked = unlockedValue;
        
        // 모델별 최대 컨텍스트 크기 계산
        const isUnlocked = maxContextUnlocked.checked;
        const maxContext = getMaxContextForModel(selectedModel, apiProvider, isUnlocked);
        
        // 잠금 해제 상태에 따라 max 값 변경
        const maxContextSlider = panelContainer.querySelector(`#${fieldMapping.contextSliderField}`);
        const maxContextCounter = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
        if (maxContextSlider && maxContextCounter) {
            maxContextSlider.setAttribute('max', maxContext);
            maxContextSlider.setAttribute('min', fieldMapping.defaultContextMin);
            maxContextCounter.setAttribute('max', maxContext);
            maxContextCounter.setAttribute('min', fieldMapping.defaultContextMin);
        }
        
        // 잠금 해제 체크박스 변경 시 모델별 최대값 재계산 및 즉시 업데이트
        maxContextUnlocked.addEventListener('change', async (e) => {
            const isUnlocked = e.target.checked;
            
            // 모델별 최대 컨텍스트 크기 계산
            const selectedModel = modelSelect?.value || '';
            const maxContextValue = getMaxContextForModel(selectedModel, apiProvider, isUnlocked);
            
            // 즉시 UI 업데이트
            const maxContextSlider = panelContainer.querySelector(`#${fieldMapping.contextSliderField}`);
            const maxContextCounter = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
            if (maxContextSlider && maxContextCounter) {
                maxContextSlider.setAttribute('max', maxContextValue);
                maxContextCounter.setAttribute('max', maxContextValue);
                
                // 현재 값이 최대값을 초과하면 제한
                const currentValue = parseInt(maxContextCounter.value) || fieldMapping.defaultContext;
                if (currentValue > maxContextValue) {
                    maxContextSlider.value = maxContextValue;
                    maxContextCounter.value = maxContextValue;
                }
            }
            
            // 모델 변경 핸들러도 호출 (설정 저장 등을 위해)
            await handleModelChange(panelContainer, apiProvider);
        });
    }
    
    // 컨텍스트 크기
    const maxContext = panelContainer.querySelector(`#${fieldMapping.contextSliderField}`);
    const maxContextCounter = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
    if (maxContext && maxContextCounter) {
        // API별 필드명으로 설정에서 값 가져오기
        const value = settings[fieldMapping.contextField] || 
                     settings.openai_max_context || 
                     fieldMapping.defaultContext;
        maxContext.value = value;
        maxContextCounter.value = value;
        
        // 모델별 최대값 적용
        if (selectedModel) {
            const isUnlocked = maxContextUnlocked?.checked || false;
            const maxContextValue = getMaxContextForModel(selectedModel, apiProvider, isUnlocked);
            maxContext.setAttribute('max', maxContextValue);
            maxContextCounter.setAttribute('max', maxContextValue);
        }
    }
    
    // 최대 응답 길이
    const maxTokens = panelContainer.querySelector(`#${fieldMapping.maxTokensField}`);
    if (maxTokens) {
        // API별 필드명으로 설정에서 값 가져오기
        const value = settings[fieldMapping.maxTokensField] || 
                     settings.openai_max_tokens || 
                     fieldMapping.defaultMaxTokens;
        maxTokens.value = value;
    }
    
    // 스트리밍
    const streamToggle = panelContainer.querySelector(`#${fieldMapping.streamField}`);
    if (streamToggle) {
        const streamValue = settings.stream_openai !== undefined ? settings.stream_openai : 
                           (settings.streaming !== undefined ? settings.streaming : true);
        streamToggle.checked = streamValue;
    }
    
    // Chat Settings 체크박스들
    const enableWebSearch = panelContainer.querySelector('#openai_enable_web_search');
    if (enableWebSearch) {
        enableWebSearch.checked = settings.enable_web_search ?? 
                                   settings.openai_enable_web_search ?? 
                                   false;
    }
    
    const functionCalling = panelContainer.querySelector('#openai_function_calling');
    if (functionCalling) {
        functionCalling.checked = settings.function_calling ?? 
                                  settings.openai_function_calling ?? 
                                  false;
    }
    
    const imageInlining = panelContainer.querySelector('#openai_image_inlining');
    if (imageInlining) {
        imageInlining.checked = settings.image_inlining ?? 
                                settings.openai_image_inlining ?? 
                                false;
    }
    
    const videoInlining = panelContainer.querySelector('#openai_video_inlining');
    if (videoInlining) {
        videoInlining.checked = settings.video_inlining ?? 
                                settings.openai_video_inlining ?? 
                                false;
    }
    
    const requestImages = panelContainer.querySelector('#openai_request_images');
    if (requestImages) {
        requestImages.checked = settings.request_images ?? 
                                settings.openai_request_images ?? 
                                false;
    }
    
    const useSysprompt = panelContainer.querySelector('#use_makersuite_sysprompt');
    if (useSysprompt) {
        useSysprompt.checked = settings.use_sysprompt ?? 
                               settings.use_makersuite_sysprompt ?? 
                               false;
    }
    
    const showThoughts = panelContainer.querySelector('#openai_show_thoughts');
    if (showThoughts) {
        showThoughts.checked = settings.show_thoughts ?? 
                               settings.openai_show_thoughts ?? 
                               false;
    }
    
    // Reasoning Effort
    const reasoningEffort = panelContainer.querySelector('#openai_reasoning_effort');
    if (reasoningEffort) {
        reasoningEffort.value = settings.reasoning_effort ?? 
                                settings.openai_reasoning_effort ?? 
                                'high';
    }
    
    // 온도
    const tempSlider = panelContainer.querySelector('#temp_openai');
    const tempCounter = panelContainer.querySelector('#temp_counter_openai');
    if (tempSlider && tempCounter) {
        const value = settings.temperature || settings.temp_openai || 1;
        tempSlider.value = value;
        tempCounter.value = value.toFixed(2);
        
        // Google Vertex AI / MakerSuite 모델의 경우 온도 제한 적용
        if (apiProvider === 'vertexai' || apiProvider === 'makersuite') {
            const modelSelectId = `model_${apiProvider}_select`;
            const modelSelect = document.getElementById(modelSelectId);
            const selectedModel = modelSelect?.value || '';
            
            if (selectedModel) {
                // vision/ultra/gemma 모델은 최대 온도 1.0, 나머지는 2.0
                const maxTemp = (selectedModel.includes('vision') || selectedModel.includes('ultra') || selectedModel.includes('gemma')) ? 1.0 : 2.0;
                tempSlider.setAttribute('max', maxTemp);
                tempCounter.setAttribute('max', maxTemp);
                
                // 현재 값이 최대값을 초과하면 제한
                const currentTemp = parseFloat(value);
                if (currentTemp > maxTemp) {
                    tempSlider.value = maxTemp;
                    tempCounter.value = maxTemp.toFixed(2);
                }
            }
        }
    }
    
    // Frequency Penalty
    const freqPenSlider = panelContainer.querySelector('#freq_pen_openai');
    const freqPenCounter = panelContainer.querySelector('#freq_pen_counter_openai');
    if (freqPenSlider && freqPenCounter) {
        const value = settings.frequency_penalty || 0;
        freqPenSlider.value = value;
        freqPenCounter.value = value.toFixed(2);
    }
    
    // Presence Penalty
    const presPenSlider = panelContainer.querySelector('#pres_pen_openai');
    const presPenCounter = panelContainer.querySelector('#pres_pen_counter_openai');
    if (presPenSlider && presPenCounter) {
        const value = settings.presence_penalty || 0;
        presPenSlider.value = value;
        presPenCounter.value = value.toFixed(2);
    }
    
    // Top K
    const topKSlider = panelContainer.querySelector('#top_k_openai');
    const topKCounter = panelContainer.querySelector('#top_k_counter_openai');
    if (topKSlider && topKCounter) {
        const value = settings.top_k || 0;
        topKSlider.value = value;
        topKCounter.value = value;
    }
    
    // Top P
    const topPSlider = panelContainer.querySelector('#top_p_openai');
    const topPCounter = panelContainer.querySelector('#top_p_counter_openai');
    if (topPSlider && topPCounter) {
        const value = settings.top_p !== undefined ? settings.top_p : 1;
        topPSlider.value = value;
        topPCounter.value = value.toFixed(2);
    }
    
    // Utility Prompts
    const impersonationPrompt = panelContainer.querySelector('#impersonation_prompt_textarea');
    if (impersonationPrompt) {
        impersonationPrompt.value = settings.impersonation_prompt || '';
    }
    
    const wiFormat = panelContainer.querySelector('#wi_format_textarea');
    if (wiFormat) {
        wiFormat.value = settings.wi_format || '{0}';
    }
    
    const scenarioFormat = panelContainer.querySelector('#scenario_format_textarea');
    if (scenarioFormat) {
        scenarioFormat.value = settings.scenario_format || '{{scenario}}';
    }
    
    const personalityFormat = panelContainer.querySelector('#personality_format_textarea');
    if (personalityFormat) {
        personalityFormat.value = settings.personality_format || '{{personality}}';
    }
    
    const groupNudgePrompt = panelContainer.querySelector('#group_nudge_prompt_textarea');
    if (groupNudgePrompt) {
        groupNudgePrompt.value = settings.group_nudge_prompt || '';
    }
    
    const newChatPrompt = panelContainer.querySelector('#newchat_prompt_textarea');
    if (newChatPrompt) {
        newChatPrompt.value = settings.new_chat_prompt || '';
    }
    
    const newGroupChatPrompt = panelContainer.querySelector('#newgroupchat_prompt_textarea');
    if (newGroupChatPrompt) {
        newGroupChatPrompt.value = settings.new_group_chat_prompt || '';
    }
    
    const newExampleChatPrompt = panelContainer.querySelector('#newexamplechat_prompt_textarea');
    if (newExampleChatPrompt) {
        newExampleChatPrompt.value = settings.new_example_chat_prompt || '';
    }
    
    const continueNudgePrompt = panelContainer.querySelector('#continue_nudge_prompt_textarea');
    if (continueNudgePrompt) {
        continueNudgePrompt.value = settings.continue_nudge_prompt || '';
    }
    
    const sendIfEmpty = panelContainer.querySelector('#send_if_empty_textarea');
    if (sendIfEmpty) {
        sendIfEmpty.value = settings.send_if_empty || '';
    }
    
    const seed = panelContainer.querySelector('#seed_openai');
    if (seed) {
        seed.value = settings.seed !== undefined ? settings.seed : -1;
    }
    
    // Chat Settings
    // Character Name Action
    const namesBehavior = panelContainer.querySelector('#names_behavior');
    const characterNamesNone = panelContainer.querySelector('#character_names_none');
    const characterNamesDefault = panelContainer.querySelector('#character_names_default');
    const characterNamesCompletion = panelContainer.querySelector('#character_names_completion');
    const characterNamesContent = panelContainer.querySelector('#character_names_content');
    const characterNamesDisplay = panelContainer.querySelector('#character_names_display');
    if (namesBehavior && characterNamesNone && characterNamesDefault && characterNamesCompletion && characterNamesContent) {
        const namesValue = settings.names_behavior !== undefined ? settings.names_behavior : 0;
        namesBehavior.value = namesValue;
        
        if (namesValue === -1) {
            characterNamesNone.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(없음)';
        } else if (namesValue === 0) {
            characterNamesDefault.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(기본값)';
        } else if (namesValue === 1) {
            characterNamesCompletion.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(Completion Object)';
        } else if (namesValue === 2) {
            characterNamesContent.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(Message Content)';
        }
    }
    
    // Continue Postfix
    const continuePostfix = panelContainer.querySelector('#continue_postfix');
    const continuePostfixNone = panelContainer.querySelector('#continue_postfix_none');
    const continuePostfixSpace = panelContainer.querySelector('#continue_postfix_space');
    const continuePostfixNewline = panelContainer.querySelector('#continue_postfix_newline');
    const continuePostfixDoubleNewline = panelContainer.querySelector('#continue_postfix_double_newline');
    const continuePostfixDisplay = panelContainer.querySelector('#continue_postfix_display');
    if (continuePostfix && continuePostfixNone && continuePostfixSpace && continuePostfixNewline && continuePostfixDoubleNewline) {
        const postfixValue = settings.continue_postfix;
        let postfixValueNum = 0;
        let displayText = '(없음)';
        
        if (postfixValue === ' ') {
            postfixValueNum = 1;
            displayText = '(공백)';
        } else if (postfixValue === '\n') {
            postfixValueNum = 2;
            displayText = '(새 줄)';
        } else if (postfixValue === '\n\n') {
            postfixValueNum = 3;
            displayText = '(이중 줄)';
        } else {
            postfixValueNum = 0;
            displayText = '(없음)';
        }
        
        continuePostfix.value = postfixValueNum;
        
        if (postfixValueNum === 0) continuePostfixNone.checked = true;
        else if (postfixValueNum === 1) continuePostfixSpace.checked = true;
        else if (postfixValueNum === 2) continuePostfixNewline.checked = true;
        else if (postfixValueNum === 3) continuePostfixDoubleNewline.checked = true;
        
        if (continuePostfixDisplay) continuePostfixDisplay.textContent = displayText;
    }
    
    // Wrap in Quotes
    const wrapInQuotes = panelContainer.querySelector('#wrap_in_quotes');
    if (wrapInQuotes) {
        wrapInQuotes.checked = settings.wrap_in_quotes || false;
    }
    
    // Continue prefill
    const continuePrefill = panelContainer.querySelector('#continue_prefill');
    if (continuePrefill) {
        continuePrefill.checked = settings.continue_prefill || false;
    }
    
    // Squash system messages
    const squashSystemMessages = panelContainer.querySelector('#squash_system_messages');
    if (squashSystemMessages) {
        squashSystemMessages.checked = settings.squash_system_messages || false;
    }
    
    // Quick Edit (PromptManager에서 로드해야 함)
    // 이 부분은 PromptManager.render() 이후에 처리됨
}

/**
 * UI 필드에서 설정 저장
 */
async function saveGenerationSettings(panelContainer) {
    // SettingsStorage - 전역 스코프에서 사용
    const currentSettings = await SettingsStorage.load();
    
    // API Provider를 현재 SettingsStorage에서 가져오기
    // (사용자가 설정 모달에서 변경한 값이 여기에 저장되어 있음)
    const apiProvider = currentSettings.apiProvider || 'openai';
    const apiKeys = currentSettings.apiKeys || {};
    const apiModels = currentSettings.apiModels || {};
    
    const updatedSettings = { ...currentSettings };
    
    // 중요: apiProvider, apiKeys, apiModels는 현재 SettingsStorage 값 유지
    // 프리셋 저장 시에는 이 값들이 프리셋에도 저장됨 (savePreset에서 filterPresetSettings 사용)
    updatedSettings.apiProvider = apiProvider;
    updatedSettings.apiKeys = { ...apiKeys };
    updatedSettings.apiModels = { ...apiModels };
    
    const fieldMapping = getApiFieldMapping(apiProvider);
    
    // 컨텍스트 크기 잠금 해제
    const maxContextUnlocked = panelContainer.querySelector(`#${fieldMapping.contextUnlockedField}`);
    if (maxContextUnlocked) {
        updatedSettings.max_context_unlocked = maxContextUnlocked.checked;
        updatedSettings.oai_max_context_unlocked = maxContextUnlocked.checked;
        updatedSettings[fieldMapping.contextUnlockedField] = maxContextUnlocked.checked;
    }
    
    // 컨텍스트 크기
    const maxContextCounter = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
    if (maxContextCounter) {
        const value = parseInt(maxContextCounter.value) || fieldMapping.defaultContext;
        // API별 필드명으로 저장 (실리태번과 호환)
        updatedSettings[fieldMapping.contextField] = value;
        // OpenAI 필드명도 함께 저장 (하위 호환성)
        if (apiProvider === 'openai' || fieldMapping.contextField === 'openai_max_context') {
            updatedSettings.openai_max_context = value;
        }
    }
    
    // 최대 응답 길이
    const maxTokens = panelContainer.querySelector(`#${fieldMapping.maxTokensField}`);
    if (maxTokens) {
        const value = parseInt(maxTokens.value) || fieldMapping.defaultMaxTokens;
        // API별 필드명으로 저장
        updatedSettings[fieldMapping.maxTokensField] = value;
        // OpenAI 필드명도 함께 저장 (하위 호환성)
        if (apiProvider === 'openai' || fieldMapping.maxTokensField === 'openai_max_tokens') {
            updatedSettings.openai_max_tokens = value;
        }
    }
    
    // 스트리밍
    const streamToggle = panelContainer.querySelector(`#${fieldMapping.streamField}`);
    if (streamToggle) {
        updatedSettings.stream_openai = streamToggle.checked;
        updatedSettings.streaming = streamToggle.checked;
        updatedSettings[fieldMapping.streamField] = streamToggle.checked;
    }
    
    // 온도
    const tempCounter = panelContainer.querySelector('#temp_counter_openai');
    if (tempCounter) {
        updatedSettings.temperature = parseFloat(tempCounter.value) || 1;
    }
    
    // Frequency Penalty
    const freqPenCounter = panelContainer.querySelector('#freq_pen_counter_openai');
    if (freqPenCounter) {
        updatedSettings.frequency_penalty = parseFloat(freqPenCounter.value) || 0;
    }
    
    // Presence Penalty
    const presPenCounter = panelContainer.querySelector('#pres_pen_counter_openai');
    if (presPenCounter) {
        updatedSettings.presence_penalty = parseFloat(presPenCounter.value) || 0;
    }
    
    // Top K
    const topKCounter = panelContainer.querySelector('#top_k_counter_openai');
    if (topKCounter) {
        updatedSettings.top_k = parseInt(topKCounter.value) || 0;
    }
    
    // Top P
    const topPCounter = panelContainer.querySelector('#top_p_counter_openai');
    if (topPCounter) {
        updatedSettings.top_p = parseFloat(topPCounter.value) !== undefined ? parseFloat(topPCounter.value) : 1;
    }
    
    // Utility Prompts
    const impersonationPrompt = panelContainer.querySelector('#impersonation_prompt_textarea');
    if (impersonationPrompt) {
        updatedSettings.impersonation_prompt = impersonationPrompt.value || '';
    }
    
    const wiFormat = panelContainer.querySelector('#wi_format_textarea');
    if (wiFormat) {
        updatedSettings.wi_format = wiFormat.value || '{0}';
    }
    
    const scenarioFormat = panelContainer.querySelector('#scenario_format_textarea');
    if (scenarioFormat) {
        updatedSettings.scenario_format = scenarioFormat.value || '{{scenario}}';
    }
    
    const personalityFormat = panelContainer.querySelector('#personality_format_textarea');
    if (personalityFormat) {
        updatedSettings.personality_format = personalityFormat.value || '{{personality}}';
    }
    
    const groupNudgePrompt = panelContainer.querySelector('#group_nudge_prompt_textarea');
    if (groupNudgePrompt) {
        updatedSettings.group_nudge_prompt = groupNudgePrompt.value || '';
    }
    
    const newChatPrompt = panelContainer.querySelector('#newchat_prompt_textarea');
    if (newChatPrompt) {
        updatedSettings.new_chat_prompt = newChatPrompt.value || '';
    }
    
    const newGroupChatPrompt = panelContainer.querySelector('#newgroupchat_prompt_textarea');
    if (newGroupChatPrompt) {
        updatedSettings.new_group_chat_prompt = newGroupChatPrompt.value || '';
    }
    
    const newExampleChatPrompt = panelContainer.querySelector('#newexamplechat_prompt_textarea');
    if (newExampleChatPrompt) {
        updatedSettings.new_example_chat_prompt = newExampleChatPrompt.value || '';
    }
    
    const continueNudgePrompt = panelContainer.querySelector('#continue_nudge_prompt_textarea');
    if (continueNudgePrompt) {
        updatedSettings.continue_nudge_prompt = continueNudgePrompt.value || '';
    }
    
    const sendIfEmpty = panelContainer.querySelector('#send_if_empty_textarea');
    if (sendIfEmpty) {
        updatedSettings.send_if_empty = sendIfEmpty.value || '';
    }
    
    const seed = panelContainer.querySelector('#seed_openai');
    if (seed) {
        updatedSettings.seed = parseInt(seed.value) !== undefined ? parseInt(seed.value) : -1;
    }
    
    // Chat Settings
    // Character Name Action
    const namesBehavior = panelContainer.querySelector('#names_behavior');
    if (namesBehavior) {
        updatedSettings.names_behavior = parseInt(namesBehavior.value) !== undefined ? parseInt(namesBehavior.value) : 0;
    }
    
    // Continue Postfix
    const continuePostfix = panelContainer.querySelector('#continue_postfix');
    if (continuePostfix) {
        const postfixValue = parseInt(continuePostfix.value) || 0;
        let postfixText = '';
        if (postfixValue === 1) postfixText = ' ';
        else if (postfixValue === 2) postfixText = '\n';
        else if (postfixValue === 3) postfixText = '\n\n';
        updatedSettings.continue_postfix = postfixText;
    }
    
    // Wrap in Quotes
    const wrapInQuotes = panelContainer.querySelector('#wrap_in_quotes');
    if (wrapInQuotes) {
        updatedSettings.wrap_in_quotes = wrapInQuotes.checked;
    }
    
    // Continue prefill
    const continuePrefill = panelContainer.querySelector('#continue_prefill');
    if (continuePrefill) {
        updatedSettings.continue_prefill = continuePrefill.checked;
    }
    
    // Squash system messages
    const squashSystemMessages = panelContainer.querySelector('#squash_system_messages');
    if (squashSystemMessages) {
        updatedSettings.squash_system_messages = squashSystemMessages.checked;
    }
    
    // Enable web search
    const enableWebSearch = panelContainer.querySelector('#openai_enable_web_search');
    if (enableWebSearch) {
        updatedSettings.enable_web_search = enableWebSearch.checked;
        updatedSettings.openai_enable_web_search = enableWebSearch.checked;
    }
    
    // Enable function calling
    const enableFunctionCalling = panelContainer.querySelector('#openai_function_calling');
    if (enableFunctionCalling) {
        updatedSettings.function_calling = enableFunctionCalling.checked;
        updatedSettings.openai_function_calling = enableFunctionCalling.checked;
    }
    
    // Send inline images
    const sendInlineImages = panelContainer.querySelector('#openai_image_inlining');
    if (sendInlineImages) {
        updatedSettings.image_inlining = sendInlineImages.checked;
        updatedSettings.openai_image_inlining = sendInlineImages.checked;
    }
    
    // Send inline videos
    const sendInlineVideos = panelContainer.querySelector('#openai_video_inlining');
    if (sendInlineVideos) {
        updatedSettings.video_inlining = sendInlineVideos.checked;
        updatedSettings.openai_video_inlining = sendInlineVideos.checked;
    }
    
    // Request inline images
    const requestInlineImages = panelContainer.querySelector('#openai_request_images');
    if (requestInlineImages) {
        updatedSettings.request_images = requestInlineImages.checked;
        updatedSettings.openai_request_images = requestInlineImages.checked;
    }
    
    // Use system prompt
    const useSystemPrompt = panelContainer.querySelector('#use_makersuite_sysprompt');
    if (useSystemPrompt) {
        updatedSettings.use_makersuite_sysprompt = useSystemPrompt.checked;
        updatedSettings.claude_use_sysprompt = useSystemPrompt.checked;
    }
    
    // Request model reasoning
    const requestModelReasoning = panelContainer.querySelector('#openai_show_thoughts');
    if (requestModelReasoning) {
        updatedSettings.show_thoughts = requestModelReasoning.checked;
        updatedSettings.openai_show_thoughts = requestModelReasoning.checked;
    }
    
    // Reasoning Effort
    const reasoningEffort = panelContainer.querySelector('#openai_reasoning_effort');
    if (reasoningEffort) {
        updatedSettings.reasoning_effort = reasoningEffort.value;
        updatedSettings.openai_reasoning_effort = reasoningEffort.value;
    }
    
    await SettingsStorage.save(updatedSettings);
}

/**
 * Preset 설정을 UI에 적용
 */
async function applyPresetToUI(panelContainer, preset) {
    if (!preset) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_PROMPT_8005', '프리셋이 null 또는 undefined');
        }
        return;
    }
    
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // API Provider 확인 (설정 모달의 select 값을 우선 확인)
    let apiProvider = 'openai';
    const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
    if (chatCompletionSourceSelect && chatCompletionSourceSelect.value) {
        apiProvider = chatCompletionSourceSelect.value;
    } else {
        apiProvider = settings.apiProvider || 'openai';
    }
    
    // data-source 필드 표시/숨김 업데이트 (중요!)
    updateSourceFields(panelContainer, apiProvider);
    
    const fieldMapping = getApiFieldMapping(apiProvider);
    
    // 현재 선택된 모델 확인
    const modelSelectId = `model_${apiProvider}_select`;
    // panelContainer 내에서 찾기
    const modelSelect = panelContainer.querySelector(`#${modelSelectId}`) || document.getElementById(modelSelectId);
    const selectedModel = modelSelect?.value || '';
    
    // 컨텍스트 크기 잠금 해제
    const maxContextUnlocked = panelContainer.querySelector(`#${fieldMapping.contextUnlockedField}`);
    if (maxContextUnlocked) {
        const unlockedValue = preset.max_context_unlocked ?? 
                             preset.oai_max_context_unlocked ?? 
                             preset[fieldMapping.contextUnlockedField];
        if (unlockedValue !== undefined) {
            maxContextUnlocked.checked = unlockedValue;
            
            // 모델별 최대 컨텍스트 크기 계산
            const maxContextValue = getMaxContextForModel(selectedModel, apiProvider, unlockedValue);
            
            // 잠금 해제 상태에 따라 max 값 변경
            const maxContextSliderForUnlock = panelContainer.querySelector(`#${fieldMapping.contextSliderField}`);
            const maxContextCounterForUnlock = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
            if (maxContextSliderForUnlock && maxContextCounterForUnlock) {
                maxContextSliderForUnlock.setAttribute('max', maxContextValue);
                maxContextCounterForUnlock.setAttribute('max', maxContextValue);
            }
        }
    }
    
    // 컨텍스트 크기
    const maxContextSlider = panelContainer.querySelector(`#${fieldMapping.contextSliderField}`);
    const maxContextCounter = panelContainer.querySelector(`#${fieldMapping.contextCounterField}`);
    if (maxContextSlider && maxContextCounter) {
        const value = preset[fieldMapping.contextField] ?? 
                     preset.openai_max_context ??
                     preset.max_context;
        if (value !== undefined) {
            maxContextSlider.value = value;
            maxContextCounter.value = value;
            // 이벤트 트리거하여 UI 업데이트
            maxContextSlider.dispatchEvent(new Event('input', { bubbles: true }));
            maxContextCounter.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } else {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_PROMPT_20022', 'maxContextSlider 또는 maxContextCounter를 찾을 수 없음');
        }
    }
    
    // 최대 응답 길이
    const maxTokens = panelContainer.querySelector(`#${fieldMapping.maxTokensField}`);
    if (maxTokens) {
        const value = preset[fieldMapping.maxTokensField] ?? 
                     preset.openai_max_tokens ??
                     preset.max_tokens;
        if (value !== undefined) {
            maxTokens.value = value;
            // 이벤트 트리거하여 UI 업데이트
            maxTokens.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    // 스트리밍
    const streamToggle = panelContainer.querySelector('#stream_toggle') || document.querySelector('#stream_toggle');
    if (streamToggle && preset.stream_openai !== undefined) {
        streamToggle.checked = preset.stream_openai;
        // 이벤트 트리거
        streamToggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Chat Settings 체크박스들
    const enableWebSearch = panelContainer.querySelector('#openai_enable_web_search') || document.querySelector('#openai_enable_web_search');
    if (enableWebSearch && preset.enable_web_search !== undefined) {
        enableWebSearch.checked = preset.enable_web_search;
        enableWebSearch.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const functionCalling = panelContainer.querySelector('#openai_function_calling') || document.querySelector('#openai_function_calling');
    if (functionCalling && preset.function_calling !== undefined) {
        functionCalling.checked = preset.function_calling;
        functionCalling.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const imageInlining = panelContainer.querySelector('#openai_image_inlining') || document.querySelector('#openai_image_inlining');
    if (imageInlining && preset.image_inlining !== undefined) {
        imageInlining.checked = preset.image_inlining;
        imageInlining.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const videoInlining = panelContainer.querySelector('#openai_video_inlining') || document.querySelector('#openai_video_inlining');
    if (videoInlining && preset.video_inlining !== undefined) {
        videoInlining.checked = preset.video_inlining;
        videoInlining.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const requestImages = panelContainer.querySelector('#openai_request_images') || document.querySelector('#openai_request_images');
    if (requestImages && preset.request_images !== undefined) {
        requestImages.checked = preset.request_images;
        requestImages.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const useSysprompt = panelContainer.querySelector('#use_makersuite_sysprompt') || document.querySelector('#use_makersuite_sysprompt');
    if (useSysprompt && preset.use_sysprompt !== undefined) {
        useSysprompt.checked = preset.use_sysprompt;
        useSysprompt.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const showThoughts = panelContainer.querySelector('#openai_show_thoughts') || document.querySelector('#openai_show_thoughts');
    if (showThoughts && preset.show_thoughts !== undefined) {
        showThoughts.checked = preset.show_thoughts;
        showThoughts.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Reasoning Effort
    const reasoningEffort = panelContainer.querySelector('#openai_reasoning_effort') || document.querySelector('#openai_reasoning_effort');
    if (reasoningEffort && preset.reasoning_effort !== undefined) {
        reasoningEffort.value = preset.reasoning_effort;
        reasoningEffort.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // 온도
    const tempSlider = panelContainer.querySelector('#temp_openai') || document.querySelector('#temp_openai');
    const tempCounter = panelContainer.querySelector('#temp_counter_openai') || document.querySelector('#temp_counter_openai');
    if (tempSlider && tempCounter && preset.temperature !== undefined) {
        tempSlider.value = preset.temperature;
        tempCounter.value = parseFloat(preset.temperature).toFixed(2);
        // 이벤트 트리거하여 UI 업데이트
        tempSlider.dispatchEvent(new Event('input', { bubbles: true }));
        tempCounter.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Frequency Penalty
    const freqPenSlider = panelContainer.querySelector('#freq_pen_openai') || document.querySelector('#freq_pen_openai');
    const freqPenCounter = panelContainer.querySelector('#freq_pen_counter_openai') || document.querySelector('#freq_pen_counter_openai');
    if (freqPenSlider && freqPenCounter && preset.frequency_penalty !== undefined) {
        freqPenSlider.value = preset.frequency_penalty;
        freqPenCounter.value = parseFloat(preset.frequency_penalty).toFixed(2);
        // 이벤트 트리거
        freqPenSlider.dispatchEvent(new Event('input', { bubbles: true }));
        freqPenCounter.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Presence Penalty
    const presPenSlider = panelContainer.querySelector('#pres_pen_openai') || document.querySelector('#pres_pen_openai');
    const presPenCounter = panelContainer.querySelector('#pres_pen_counter_openai') || document.querySelector('#pres_pen_counter_openai');
    if (presPenSlider && presPenCounter && preset.presence_penalty !== undefined) {
        presPenSlider.value = preset.presence_penalty;
        presPenCounter.value = parseFloat(preset.presence_penalty).toFixed(2);
        // 이벤트 트리거
        presPenSlider.dispatchEvent(new Event('input', { bubbles: true }));
        presPenCounter.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Top K
    const topKSlider = panelContainer.querySelector('#top_k_openai') || document.querySelector('#top_k_openai');
    const topKCounter = panelContainer.querySelector('#top_k_counter_openai') || document.querySelector('#top_k_counter_openai');
    if (topKSlider && topKCounter && preset.top_k !== undefined) {
        topKSlider.value = preset.top_k;
        topKCounter.value = preset.top_k;
        // 이벤트 트리거
        topKSlider.dispatchEvent(new Event('input', { bubbles: true }));
        topKCounter.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Top P
    const topPSlider = panelContainer.querySelector('#top_p_openai') || document.querySelector('#top_p_openai');
    const topPCounter = panelContainer.querySelector('#top_p_counter_openai') || document.querySelector('#top_p_counter_openai');
    if (topPSlider && topPCounter && preset.top_p !== undefined) {
        topPSlider.value = preset.top_p;
        topPCounter.value = parseFloat(preset.top_p).toFixed(2);
        // 이벤트 트리거
        topPSlider.dispatchEvent(new Event('input', { bubbles: true }));
        topPCounter.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Utility Prompts
    const impersonationPrompt = panelContainer.querySelector('#impersonation_prompt_textarea');
    if (impersonationPrompt && preset.impersonation_prompt !== undefined) {
        impersonationPrompt.value = preset.impersonation_prompt;
    }
    
    const wiFormat = panelContainer.querySelector('#wi_format_textarea');
    if (wiFormat && preset.wi_format !== undefined) {
        wiFormat.value = preset.wi_format;
    }
    
    const scenarioFormat = panelContainer.querySelector('#scenario_format_textarea');
    if (scenarioFormat && preset.scenario_format !== undefined) {
        scenarioFormat.value = preset.scenario_format;
    }
    
    const personalityFormat = panelContainer.querySelector('#personality_format_textarea');
    if (personalityFormat && preset.personality_format !== undefined) {
        personalityFormat.value = preset.personality_format;
    }
    
    const groupNudgePrompt = panelContainer.querySelector('#group_nudge_prompt_textarea');
    if (groupNudgePrompt && preset.group_nudge_prompt !== undefined) {
        groupNudgePrompt.value = preset.group_nudge_prompt;
    }
    
    const newChatPrompt = panelContainer.querySelector('#newchat_prompt_textarea');
    if (newChatPrompt && preset.new_chat_prompt !== undefined) {
        newChatPrompt.value = preset.new_chat_prompt;
    }
    
    const newGroupChatPrompt = panelContainer.querySelector('#newgroupchat_prompt_textarea');
    if (newGroupChatPrompt && preset.new_group_chat_prompt !== undefined) {
        newGroupChatPrompt.value = preset.new_group_chat_prompt;
    }
    
    const newExampleChatPrompt = panelContainer.querySelector('#newexamplechat_prompt_textarea');
    if (newExampleChatPrompt && preset.new_example_chat_prompt !== undefined) {
        newExampleChatPrompt.value = preset.new_example_chat_prompt;
    }
    
    const continueNudgePrompt = panelContainer.querySelector('#continue_nudge_prompt_textarea');
    if (continueNudgePrompt && preset.continue_nudge_prompt !== undefined) {
        continueNudgePrompt.value = preset.continue_nudge_prompt;
    }
    
    // 프롬프트 리스트 업데이트는 setupPromptsPanelEvents의 applyPresetSettings 오버라이드에서 처리
    // (중복 업데이트 방지를 위해 여기서는 제거)
    
    const sendIfEmpty = panelContainer.querySelector('#send_if_empty_textarea');
    if (sendIfEmpty && preset.send_if_empty !== undefined) {
        sendIfEmpty.value = preset.send_if_empty;
    }
    
    const seed = panelContainer.querySelector('#seed_openai');
    if (seed && preset.seed !== undefined) {
        seed.value = preset.seed;
    }
    
    // Continue Prefill
    const continuePrefill = panelContainer.querySelector('#continue_prefill');
    if (continuePrefill && preset.continue_prefill !== undefined) {
        continuePrefill.checked = preset.continue_prefill;
        continuePrefill.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Continue Postfix
    const continuePostfix = panelContainer.querySelector('#continue_postfix');
    const continuePostfixNone = panelContainer.querySelector('#continue_postfix_none');
    const continuePostfixSpace = panelContainer.querySelector('#continue_postfix_space');
    const continuePostfixNewline = panelContainer.querySelector('#continue_postfix_newline');
    const continuePostfixDoubleNewline = panelContainer.querySelector('#continue_postfix_double_newline');
    const continuePostfixDisplay = panelContainer.querySelector('#continue_postfix_display');
    if (continuePostfix && preset.continue_postfix !== undefined) {
        const postfixValue = preset.continue_postfix;
        let postfixValueNum = 0;
        let displayText = '(없음)';
        
        if (postfixValue === ' ') {
            postfixValueNum = 1;
            displayText = '(공백)';
        } else if (postfixValue === '\n') {
            postfixValueNum = 2;
            displayText = '(새 줄)';
        } else if (postfixValue === '\n\n') {
            postfixValueNum = 3;
            displayText = '(이중 줄)';
        } else {
            postfixValueNum = 0;
            displayText = '(없음)';
        }
        
        continuePostfix.value = postfixValueNum;
        
        if (continuePostfixNone) continuePostfixNone.checked = (postfixValueNum === 0);
        if (continuePostfixSpace) continuePostfixSpace.checked = (postfixValueNum === 1);
        if (continuePostfixNewline) continuePostfixNewline.checked = (postfixValueNum === 2);
        if (continuePostfixDoubleNewline) continuePostfixDoubleNewline.checked = (postfixValueNum === 3);
        
        if (continuePostfixDisplay) continuePostfixDisplay.textContent = displayText;
        
        // 이벤트 트리거
        if (continuePostfixNone && postfixValueNum === 0) continuePostfixNone.dispatchEvent(new Event('change', { bubbles: true }));
        if (continuePostfixSpace && postfixValueNum === 1) continuePostfixSpace.dispatchEvent(new Event('change', { bubbles: true }));
        if (continuePostfixNewline && postfixValueNum === 2) continuePostfixNewline.dispatchEvent(new Event('change', { bubbles: true }));
        if (continuePostfixDoubleNewline && postfixValueNum === 3) continuePostfixDoubleNewline.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Squash System Messages
    const squashSystemMessages = panelContainer.querySelector('#squash_system_messages');
    if (squashSystemMessages && preset.squash_system_messages !== undefined) {
        squashSystemMessages.checked = preset.squash_system_messages;
        squashSystemMessages.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Wrap in Quotes
    const wrapInQuotes = panelContainer.querySelector('#wrap_in_quotes');
    if (wrapInQuotes && preset.wrap_in_quotes !== undefined) {
        wrapInQuotes.checked = preset.wrap_in_quotes;
        wrapInQuotes.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Names Behavior
    const namesBehavior = panelContainer.querySelector('#names_behavior');
    const characterNamesNone = panelContainer.querySelector('#character_names_none');
    const characterNamesDefault = panelContainer.querySelector('#character_names_default');
    const characterNamesCompletion = panelContainer.querySelector('#character_names_completion');
    const characterNamesContent = panelContainer.querySelector('#character_names_content');
    const characterNamesDisplay = panelContainer.querySelector('#character_names_display');
    if (namesBehavior && preset.names_behavior !== undefined) {
        const namesValue = preset.names_behavior;
        namesBehavior.value = namesValue;
        
        if (characterNamesNone && namesValue === -1) {
            characterNamesNone.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(없음)';
        } else if (characterNamesDefault && namesValue === 0) {
            characterNamesDefault.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(기본값)';
        } else if (characterNamesCompletion && namesValue === 1) {
            characterNamesCompletion.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(Completion Object)';
        } else if (characterNamesContent && namesValue === 2) {
            characterNamesContent.checked = true;
            if (characterNamesDisplay) characterNamesDisplay.textContent = '(Message Content)';
        }
        
        // 이벤트 트리거
        if (characterNamesNone && namesValue === -1) characterNamesNone.dispatchEvent(new Event('change', { bubbles: true }));
        if (characterNamesDefault && namesValue === 0) characterNamesDefault.dispatchEvent(new Event('change', { bubbles: true }));
        if (characterNamesCompletion && namesValue === 1) characterNamesCompletion.dispatchEvent(new Event('change', { bubbles: true }));
        if (characterNamesContent && namesValue === 2) characterNamesContent.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * data-source 속성에 따라 필드 표시/숨김 처리 (실리태번 방식)
 */
function updateSourceFields(panelContainer, apiProvider) {
    if (!panelContainer) {
        console.warn('[updateSourceFields] panelContainer가 null입니다.');
        return;
    }
    
    if (!apiProvider) {
        console.warn('[updateSourceFields] apiProvider가 없습니다.');
        return;
    }
    
    const elements = panelContainer.querySelectorAll('[data-source]');
    
    if (elements.length === 0) {
        console.error('[updateSourceFields] data-source 속성을 가진 요소를 찾을 수 없습니다!', {
            panelContainer: panelContainer,
            innerHTMLLength: panelContainer.innerHTML?.length || 0,
            id: panelContainer.id,
            className: panelContainer.className
        });
        return;
    }
    
    let visibleCount = 0;
    let hiddenCount = 0;
    
    elements.forEach((element) => {
        const dataSource = element.getAttribute('data-source');
        if (!dataSource) {
            return;
        }
        
        const validSources = dataSource.split(',').map(s => s.trim());
        const shouldShow = validSources.includes(apiProvider);
        
        if (shouldShow) {
            element.style.display = '';
            visibleCount++;
        } else {
            element.style.display = 'none';
            hiddenCount++;
        }
    });
    
    // 문제 발생 시에만 로그 출력
    if (visibleCount === 0 && elements.length > 0) {
        console.error('[updateSourceFields] 경고: 표시된 요소가 없습니다! API Provider:', apiProvider);
        console.error('[updateSourceFields] 첫 번째 요소의 data-source:', elements[0]?.getAttribute('data-source'));
    }
}

/**
 * 프롬프트 패널 내에서 Preset 이벤트 리스너 설정
 * @param {HTMLElement} panelContainer - 패널 컨테이너
 * @param {PresetManager} manager - PresetManager 인스턴스
 */
function setupPresetEventListenersInPanel(panelContainer, manager) {
    // panelContainer 내에서 버튼 찾기
    const presetSelect = panelContainer.querySelector('#settings_preset_openai');

    // Update 버튼
    const updateBtn = panelContainer.querySelector('#update_oai_preset');
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            // 프리셋 저장 전에 현재 UI의 모든 설정을 SettingsStorage에 저장 (체크박스 값 포함)
            await saveGenerationSettings(panelContainer);
            
            // 이제 현재 SettingsStorage의 값으로 프리셋 저장
            await manager.updatePreset();
        });
    }

    // Save as 버튼
    const saveAsBtn = panelContainer.querySelector('#new_oai_preset');
    if (saveAsBtn) {
        saveAsBtn.addEventListener('click', async () => {
            await manager.savePresetAs();
        });
    }

    // Rename 버튼
    const renameBtn = panelContainer.querySelector('[data-preset-manager-rename="openai"]');
    if (renameBtn) {
        renameBtn.addEventListener('click', async () => {
            await manager.renamePreset();
        });
    }

    // Import 버튼
    const importBtn = panelContainer.querySelector('#import_oai_preset');
    const importFile = panelContainer.querySelector('#openai_preset_import_file');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await manager.importPreset(file);
                e.target.value = ''; // 리셋
            }
        });
    }

    // Export 버튼
    const exportBtn = panelContainer.querySelector('#export_oai_preset');
    if (exportBtn) {
        exportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await manager.exportPreset();
        });
    }

    // Delete 버튼
    const deleteBtn = panelContainer.querySelector('#delete_oai_preset');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await manager.deletePreset();
        });
    }
}

async function setupPromptsPanelEvents(panelContainer) {
    // console.log 제거 - 너무 많은 로그 방지
    // 접기/펼치기 섹션 설정
    setupCollapsibleSections(panelContainer);
    
    // 슬라이더와 숫자 입력 동기화
    setupSliderSync(panelContainer);
    
    // PresetManager 초기화 및 이벤트 설정
    // registerPresetManager - 전역 스코프에서 사용
    // SettingsManager - 전역 스코프에서 사용
    // SettingsStorage - 전역 스코프에서 사용
    
    // 현재 선택된 프리셋 확인 (loadGenerationSettings 이전에)
    const settings = await SettingsStorage.load();
    const lastSelectedPreset = settings.preset_settings_openai;
    let shouldLoadPreset = false;
    let presetToLoad = null;
    let presetAlreadyLoaded = false; // 프리셋이 이미 로드되었는지 추적
    
    // 프리셋이 선택되어 있고 Default가 아니면 프리셋 로드
    // PresetManager를 먼저 생성해야 getCompletionPresetByName을 호출할 수 있음
    let presetSelect = panelContainer.querySelector('#settings_preset_openai');
    if (presetSelect && lastSelectedPreset && lastSelectedPreset !== 'Default' && lastSelectedPreset !== 'gui') {
        try {
        // PresetManager 등록 (임시로 생성, 나중에 다시 사용)
        const tempManager = registerPresetManager(presetSelect, 'openai');
        const { preset_names } = await tempManager.getPresetList();
        const presetIndex = preset_names[lastSelectedPreset];
        
        if (presetIndex !== undefined) {
            // 프리셋 데이터 가져오기
            const preset = await tempManager.getCompletionPresetByName(lastSelectedPreset);
            if (preset) {
                presetToLoad = preset;
                shouldLoadPreset = true;
            }
            }
        } catch (error) {
            console.warn('프리셋 로드 실패:', error);
        }
    }
    
    // 설정 로드
    // 프리셋이 있으면 프리셋 설정을 먼저 적용하고, 없으면 일반 설정 로드
    // 중요: 사용자가 설정 모달에서 변경한 API가 있으면 그것을 우선해야 함
    const chatCompletionSourceSelectBeforePreset = document.getElementById('chat-completion-source');
    const userSelectedApiProvider = chatCompletionSourceSelectBeforePreset?.value || null;
    
    let presetApiProvider = null; // 프리셋에 저장된 apiProvider (있다면)
    
    if (shouldLoadPreset && presetToLoad) {
        try {
        // 프리셋 설정을 SettingsStorage에 먼저 적용 (프롬프트 포함)
        const currentSettings = await SettingsStorage.load();
        const { prompts: presetPrompts, prompt_order: presetPromptOrder, apiProvider, apiKeys, apiModels, ...presetSettingsWithoutPrompts } = presetToLoad;
        
        // 프리셋에 apiProvider가 있고, 사용자가 설정 모달에서 다른 API를 선택하지 않았을 때만 적용
        // 사용자가 설정 모달에서 API를 변경했다면 그것을 우선 (프리셋이 API를 덮어쓰지 않도록)
        if (apiProvider && !userSelectedApiProvider) {
            // 사용자가 설정 모달에서 API를 변경하지 않았고, 프리셋에 apiProvider가 있으면 적용
            if (apiProvider !== currentSettings.apiProvider) {
                presetApiProvider = apiProvider;
                // 토스트 알림 표시 (showToast는 전역 스코프에서 사용)
                if (typeof showToast === 'function') {
                    showToast(`프리셋 "${presetToLoad.name || 'Default'}"의 API가 "${apiProvider}"로 변경되었습니다.`, 'info');
                }
            }
        }
        
        // 프리셋에 저장된 apiProvider가 있으면 SettingsStorage에도 적용
        // 하지만 사용자가 설정 모달에서 선택한 API가 있으면 그것을 우선
        // 중요: 사용자가 설정 모달에서 선택한 API가 있으면 절대 프리셋의 API로 덮어쓰지 않음
        const finalApiProvider = userSelectedApiProvider || presetApiProvider || currentSettings.apiProvider;
        const mergedForLoad = {
            ...currentSettings,
            ...presetSettingsWithoutPrompts,
            preset_settings_openai: presetToLoad.name || 'Default',
            // 사용자가 설정 모달에서 선택한 API를 우선, 없으면 프리셋의 API, 그것도 없으면 현재 설정 유지
            // 사용자가 선택한 API가 있으면 절대 덮어쓰지 않음
            apiProvider: finalApiProvider,
            // apiKeys와 apiModels는 프리셋을 무시하고 항상 현재 설정 유지
            // 중요: 프리셋을 불러와도 사용자가 입력한 API 키와 모델은 유지되어야 함
            apiKeys: currentSettings.apiKeys,
            apiModels: currentSettings.apiModels,
        };
        
        // 프롬프트도 포함
        if (presetPrompts !== undefined && Array.isArray(presetPrompts) && presetPrompts.length > 0) {
            mergedForLoad.prompts = presetPrompts;
        }
        if (presetPromptOrder !== undefined && Array.isArray(presetPromptOrder) && presetPromptOrder.length > 0) {
            mergedForLoad.prompt_order = presetPromptOrder;
        }
        
        await SettingsStorage.save(mergedForLoad);
        
        // API Provider 변경 이벤트 발송 (설정 모달 등 다른 UI도 업데이트되도록)
        // 사용자가 설정 모달에서 선택한 API가 있으면 그것을 우선
        const apiProviderForEvent = userSelectedApiProvider || presetApiProvider;
        if (apiProviderForEvent) {
            window.dispatchEvent(new CustomEvent('api-provider-changed', { 
                detail: { apiProvider: apiProviderForEvent } 
            }));
            
            // 설정 모달의 select도 업데이트 (사용자가 선택한 값이 있으면 그것으로, 없으면 프리셋 값으로)
            const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
            if (chatCompletionSourceSelect && Array.from(chatCompletionSourceSelect.options).some(opt => opt.value === apiProviderForEvent)) {
                chatCompletionSourceSelect.value = apiProviderForEvent;
                // SettingsManager가 있다면 UI도 업데이트
                if (window.settingsManager) {
                    window.settingsManager.toggleProviderSpecificSettings();
                    window.settingsManager.updateModelOptions();
                }
            }
        }
        
            presetAlreadyLoaded = true; // 프리셋 적용 완료
        } catch (error) {
            console.warn('프리셋 설정 저장 실패:', error);
        }
    }
    
    // API Provider에 따라 필드 표시/숨김 업데이트
    // 프롬프트 패널이 열릴 때 최신 API Provider 확인
    // 중요: 설정 모달의 select 값이 가장 최신이므로 항상 우선해야 함
    // (사용자가 설정 모달에서 변경한 API가 반영되어야 함)
    // loadGenerationSettings 호출 전에 최신 API를 확인해야 함
    let apiProviderForFields = 'openai';
    
    // 설정 모달의 select 값을 우선 확인 (사용자가 선택한 최신 값)
    const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
    if (chatCompletionSourceSelect && chatCompletionSourceSelect.value) {
        apiProviderForFields = chatCompletionSourceSelect.value;
    } else {
        // select 값이 없으면 SettingsStorage에서 확인
        const currentSettingsAfterPreset = await SettingsStorage.load();
        apiProviderForFields = currentSettingsAfterPreset.apiProvider || 'openai';
    }
    
    // 필드 업데이트 (중요: 모든 data-source 요소 표시/숨김)
    // loadGenerationSettings 호출 전에 먼저 필드를 올바른 API로 표시해야 함
    if (panelContainer) {
        updateSourceFields(panelContainer, apiProviderForFields);
    } else {
        console.error('[setupPromptsPanelEvents] panelContainer가 null입니다!');
    }
    
    // 최신 API Provider로 설정 로드 (필드 업데이트 후)
    await loadGenerationSettings(panelContainer, apiProviderForFields);
    
    // 프리셋이 이미 적용된 경우, loadGenerationSettings 이후에 UI 업데이트 (체크박스 등)
    if (shouldLoadPreset && presetToLoad) {
        await applyPresetToUI(panelContainer, presetToLoad);
    }
    
    // API Provider 변경 감지 함수 정의 (반드시 사용 전에 정의)
    const handleApiProviderChange = async () => {
        // SettingsStorage는 이미 위에서 import됨
        const settings = await SettingsStorage.load();
        let apiProvider = settings.apiProvider || 'openai';
        
        // 설정 모달의 select에서도 확인 (더 최신일 수 있음)
        const chatCompletionSourceSelectInHandler = document.getElementById('chat-completion-source');
        if (chatCompletionSourceSelectInHandler && chatCompletionSourceSelectInHandler.value) {
            apiProvider = chatCompletionSourceSelectInHandler.value;
        }
        
        // 필드 업데이트
        if (panelContainer) {
            updateSourceFields(panelContainer, apiProvider);
    
            // 컨텍스트 크기 업데이트도 함께 수행
            await handleModelChange(panelContainer, apiProvider);
        } else {
            console.warn('[promptsTemplatesPanel.handleApiProviderChange] panelContainer가 null입니다.');
        }
    };
    
    // 초기 모델 변경 핸들러 호출 (컨텍스트 크기 최대값 설정용)
    await handleModelChange(panelContainer, apiProviderForFields);
    
    // 프리셋을 불러올 때는 프리셋의 apiProvider로 SettingsStorage가 이미 업데이트되었고,
    // 사용자가 설정 모달에서 API를 변경하면 api-provider-changed 이벤트를 통해 자동으로 업데이트됨
    
    // PresetManager 등록 (presetSelect는 위에서 이미 가져옴)
    if (presetSelect) {
        const manager = registerPresetManager(presetSelect, 'openai');

        // applyPresetSettings 오버라이드하여 UI에 적용
        const originalApplyPresetSettings = manager.applyPresetSettings.bind(manager);
        manager.applyPresetSettings = async (preset) => {
            // 중요: 사용자가 설정 모달에서 선택한 API를 우선 확인
            const chatCompletionSourceSelectForPreset = document.getElementById('chat-completion-source');
            const userSelectedApiProvider = chatCompletionSourceSelectForPreset?.value || null;
            
            // 프리셋에 저장된 apiProvider 확인 (originalApplyPresetSettings 호출 전에)
            const presetApiProviderFromPreset = preset?.apiProvider;
            const currentSettingsBefore = await SettingsStorage.load();
            const currentApiProviderBefore = currentSettingsBefore.apiProvider || 'openai';
            
            // 사용자가 설정 모달에서 선택한 API가 있으면 프리셋의 apiProvider를 제거하여 덮어쓰지 않도록 함
            const presetToApply = { ...preset };
            if (userSelectedApiProvider && presetApiProviderFromPreset) {
                // 사용자가 선택한 API를 우선하기 위해 프리셋의 apiProvider를 제거
                delete presetToApply.apiProvider;
            }
            
            // originalApplyPresetSettings 호출 (프리셋의 apiProvider가 제거된 상태로 호출)
            await originalApplyPresetSettings(presetToApply);
            
            // originalApplyPresetSettings 호출 후 SettingsStorage 다시 확인
            const currentSettingsAfter = await SettingsStorage.load();
            const currentApiProviderAfter = currentSettingsAfter.apiProvider || 'openai';
            
            // 최종 API Provider 결정: 사용자가 설정 모달에서 선택한 값이 있으면 그것을 우선
            const finalApiProvider = userSelectedApiProvider || presetApiProviderFromPreset || currentApiProviderAfter;
            
            // 사용자가 설정 모달에서 선택한 API가 있으면 그것으로 SettingsStorage 업데이트
            if (userSelectedApiProvider && userSelectedApiProvider !== currentApiProviderAfter) {
                await SettingsStorage.save({
                    ...currentSettingsAfter,
                    apiProvider: userSelectedApiProvider
                });
            }
            
            // 프리셋에 저장된 apiProvider가 있고, 사용자가 설정 모달에서 선택하지 않았고, 변경되었으면 토스트 알림
            if (presetApiProviderFromPreset && !userSelectedApiProvider && presetApiProviderFromPreset !== currentApiProviderBefore) {
                // 토스트 알림 표시
                if (typeof showToast === 'function') {
                    showToast(`프리셋 "${preset.name || 'Default'}"의 API가 "${presetApiProviderFromPreset}"로 변경되었습니다.`, 'info');
                }
                
                // API Provider 변경 이벤트 발송 (설정 모달 등 다른 UI도 업데이트되도록)
                window.dispatchEvent(new CustomEvent('api-provider-changed', { 
                    detail: { apiProvider: presetApiProviderFromPreset } 
                }));
                
                // 설정 모달의 select도 업데이트
                if (chatCompletionSourceSelectForPreset && Array.from(chatCompletionSourceSelectForPreset.options).some(opt => opt.value === presetApiProviderFromPreset)) {
                    chatCompletionSourceSelectForPreset.value = presetApiProviderFromPreset;
                    // SettingsManager가 있다면 UI도 업데이트
                    if (window.settingsManager) {
                        window.settingsManager.toggleProviderSpecificSettings();
                        window.settingsManager.updateModelOptions();
                    }
                }
            }
            
            // 필드 업데이트 (사용자가 선택한 값 또는 프리셋의 값 또는 현재 설정)
            updateSourceFields(panelContainer, finalApiProvider);
            await handleModelChange(panelContainer, finalApiProvider);
            
            // UI 업데이트는 항상 호출되도록 보장
            await applyPresetToUI(panelContainer, preset);
            
            // PromptManager 업데이트 (프리셋 변경 시 항상 SettingsStorage에서 최신 데이터 로드)
            // PromptManager가 초기화된 후에만 업데이트 (없으면 조용히 넘어감)
            if (window.promptManagerInstance) {
                const promptManager = window.promptManagerInstance;
                
                // PromptManager가 아직 초기화되지 않았으면 건너뛰기
                if (!promptManager.configuration || !promptManager.serviceSettings) {
                    return;
                }
                
                // SettingsStorage에서 최신 설정 로드 (프리셋이 저장된 후)
                const settings = await SettingsStorage.load();
                
                // 기본 프롬프트 데이터 준비 (promptsTemplatesPanel.js의 초기화 로직과 동일)
                const defaultPrompts = [
                    { name: 'Main Prompt', system_prompt: true, role: 'system', content: 'Write {{char}}\'s next reply in a fictional chat between {{char}} and {{user}}.', identifier: 'main' },
                    { name: 'Auxiliary Prompt', system_prompt: true, role: 'system', content: '', identifier: 'nsfw' },
                    { identifier: 'dialogueExamples', name: 'Chat Examples', system_prompt: true, marker: true },
                    { name: 'Post-History Instructions', system_prompt: true, role: 'system', content: '', identifier: 'jailbreak' },
                    { identifier: 'chatHistory', name: 'Chat History', system_prompt: true, marker: true },
                    { identifier: 'worldInfoAfter', name: 'World Info (after)', system_prompt: true, marker: true },
                    { identifier: 'worldInfoBefore', name: 'World Info (before)', system_prompt: true, marker: true },
                    { identifier: 'enhanceDefinitions', role: 'system', name: 'Enhance Definitions', content: 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.', system_prompt: true, marker: false },
                    { identifier: 'charDescription', name: 'Char Description', system_prompt: true, marker: true },
                    { identifier: 'charPersonality', name: 'Char Personality', system_prompt: true, marker: true },
                    { identifier: 'scenario', name: 'Scenario', system_prompt: true, marker: true },
                    { identifier: 'personaDescription', name: 'Persona Description', system_prompt: true, marker: true }
                ];
                
                const defaultPromptOrder = [{
                    character_id: 100001,
                    order: [
                        { identifier: 'main', enabled: true },
                        { identifier: 'worldInfoBefore', enabled: true },
                        { identifier: 'charDescription', enabled: true },
                        { identifier: 'charPersonality', enabled: true },
                        { identifier: 'scenario', enabled: true },
                        { identifier: 'enhanceDefinitions', enabled: false },
                        { identifier: 'nsfw', enabled: true },
                        { identifier: 'worldInfoAfter', enabled: true },
                        { identifier: 'dialogueExamples', enabled: true },
                        { identifier: 'chatHistory', enabled: true },
                        { identifier: 'jailbreak', enabled: true }
                    ]
                }];
                
                // 프롬프트와 프롬프트 순서 결정 (프리셋 우선, 없으면 저장소, 없으면 기본값)
                // 프리셋에 prompts/prompt_order가 있으면 사용, 없으면 SettingsStorage에서 로드
                // 단, Default 프리셋('Default' 또는 'gui')으로 전환할 때는 기본 프롬프트를 사용 (SettingsStorage에 이전 프리셋 데이터가 남아있을 수 있음)
                // 또한 prompts/prompt_order가 undefined인 경우도 Default 프리셋으로 간주 (selectPreset에서 undefined로 설정한 경우)
                const isDefaultPreset = (preset.name === 'Default' || preset.name === 'gui') || 
                                        (preset.prompts === undefined && preset.prompt_order === undefined);
                
                let prompts = preset.prompts !== undefined && Array.isArray(preset.prompts) && preset.prompts.length > 0
                    ? preset.prompts
                    : (isDefaultPreset ? defaultPrompts : (settings.prompts && settings.prompts.length > 0 ? settings.prompts : defaultPrompts));
                
                let prompt_order = preset.prompt_order !== undefined && Array.isArray(preset.prompt_order) && preset.prompt_order.length > 0
                    ? preset.prompt_order
                    : (isDefaultPreset ? defaultPromptOrder : (settings.prompt_order && settings.prompt_order.length > 0 ? settings.prompt_order : defaultPromptOrder));
                
                // prompt_order에 dummyId(100001)가 없으면 추가
                const hasDummyId = prompt_order.some(order => order.character_id === 100001);
                if (!hasDummyId) {
                    prompt_order = [...prompt_order, ...defaultPromptOrder];
                }
                
                // PromptManager의 serviceSettings 업데이트
                promptManager.serviceSettings.prompts = prompts;
                promptManager.serviceSettings.prompt_order = prompt_order;
                
                // 설정 정리 (누락된 프롬프트 추가 등)
                promptManager.sanitizeServiceSettings();
                
                // 프리셋 변경 시 선택된 프롬프트 초기화 및 편집 모달 닫기
                promptManager.selectedPromptId = '';
                
                // append_prompt select 초기화
                const appendPromptSelect = document.getElementById(`${promptManager.configuration.prefix}prompt_manager_footer_append_prompt`);
                if (appendPromptSelect) {
                    appendPromptSelect.value = '';
                }
                
                // 편집 모달이 열려있으면 닫기
                const prefix = promptManager.configuration.prefix;
                const popup = document.getElementById(`${prefix}prompt_manager_popup`);
                if (popup && popup.style.display !== 'none' && !popup.classList.contains('hidden')) {
                    promptManager.hidePopup();
                    promptManager.clearEditForm();
                    promptManager.clearInspectForm();
                }
                
                // PromptManager 다시 렌더링
                await promptManager.render();
                
                // Default 프리셋으로 전환한 경우, 기본 프롬프트를 SettingsStorage에도 저장
                if (isDefaultPreset) {
                    const currentSettings = await SettingsStorage.load();
                    const updatedSettings = {
                        ...currentSettings,
                        prompts: prompts,
                        prompt_order: prompt_order,
                        preset_settings_openai: 'Default',
                    };
                    await SettingsStorage.save(updatedSettings);
                }
                
                // Quick Edit 필드에 새로운 프롬프트 내용 로드 (프리셋 변경 후)
                // PromptManager가 초기화된 후에만 접근
                if (window.promptManagerInstance) {
                    const promptManager = window.promptManagerInstance;
                const mainPrompt = promptManager.getPromptById('main');
                const nsfwPrompt = promptManager.getPromptById('nsfw');
                const jailbreakPrompt = promptManager.getPromptById('jailbreak');
                
                const mainQuickEdit = panelContainer.querySelector('#main_prompt_quick_edit_textarea');
                const nsfwQuickEdit = panelContainer.querySelector('#nsfw_prompt_quick_edit_textarea');
                const jailbreakQuickEdit = panelContainer.querySelector('#jailbreak_prompt_quick_edit_textarea');
                
                if (mainQuickEdit && mainPrompt) {
                    mainQuickEdit.value = mainPrompt.content || '';
                }
                if (nsfwQuickEdit && nsfwPrompt) {
                    nsfwQuickEdit.value = nsfwPrompt.content || '';
                }
                if (jailbreakQuickEdit && jailbreakPrompt) {
                    jailbreakQuickEdit.value = jailbreakPrompt.content || '';
                }
                }
            }
            // PromptManager가 없으면 조용히 넘어감 (초기화되지 않은 상태에서 프리셋 변경 시)
        };
        
        // 프리셋 목록 채우기 (populatePresetSelect 내부에서 마지막 선택된 프리셋 복원)
        await manager.populatePresetSelect();
        
        // 마지막에 선택한 preset 복원 (populatePresetSelect는 셀렉트 값만 설정하므로 실제 프리셋 적용 필요)
        // 단, 이미 위에서 프리셋을 적용했다면(presetAlreadyLoaded) 다시 적용하지 않음
        const settingsForRestore = await SettingsStorage.load();
        const lastSelectedPresetForRestore = settingsForRestore.preset_settings_openai;
        
        if (lastSelectedPresetForRestore && lastSelectedPresetForRestore !== 'Default' && lastSelectedPresetForRestore !== 'gui') {
            try {
            // preset 이름으로 찾기
            const { preset_names } = await manager.getPresetList();
            const presetIndex = preset_names[lastSelectedPresetForRestore];
            
            // 셀렉트에 올바른 값이 설정되어 있는지 확인
            const currentSelectName = manager.getSelectedPresetName();
            if (presetIndex !== undefined) {
                    // 셀렉트 값이 올바르지 않으면 설정 (UI만 업데이트)
                if (currentSelectName !== lastSelectedPresetForRestore && manager.select) {
                    manager.select.value = String(presetIndex);
                }
                
                    // 이미 위에서 프리셋을 적용하지 않았을 때만 selectPreset 호출 (applyPresetSettings 포함)
                    // presetAlreadyLoaded가 false일 때만 적용 (이미 적용했다면 중복 방지)
                    if (!presetAlreadyLoaded) {
                    await manager.selectPreset(presetIndex);
                }
                }
            } catch (error) {
                // 에러 발생 시 로그만 남기고 계속 진행 (기본 프리셋 사용)
                console.warn('프리셋 복원 실패:', error);
            }
        }

        // 임시 SettingsManager 인스턴스 생성하여 이벤트 리스너 설정
        const tempElements = {
            settingsModal: panelContainer,
            closeSettingsBtn: null,
        };
        const tempSettingsManager = new SettingsManager(tempElements);
        
        // panelContainer 내에서 버튼 찾기 및 이벤트 리스너 설정
        setupPresetEventListenersInPanel(panelContainer, manager);
    }

    // PromptManager 초기화 및 렌더링
    // PromptManager - 전역 스코프에서 사용
    
        // PromptManager 인스턴스 생성 (전역 전략)
        const promptManagerContainer = panelContainer.querySelector('#completion_prompt_manager');
        if (promptManagerContainer) {
            // PromptManager 인스턴스 생성
            const promptManager = new PromptManager();
            
            // 설정 불러오기 (위에서 이미 SettingsStorage import됨)
            const settings = await SettingsStorage.load();
            
            // 기본 프롬프트 데이터 (실리태번 Default.json 기준)
            const defaultPrompts = [
                {
                    name: 'Main Prompt',
                    system_prompt: true,
                    role: 'system',
                    content: 'Write {{char}}\'s next reply in a fictional chat between {{char}} and {{user}}.',
                    identifier: 'main'
                },
                {
                    name: 'Auxiliary Prompt',
                    system_prompt: true,
                    role: 'system',
                    content: '',
                    identifier: 'nsfw'
                },
                {
                    identifier: 'dialogueExamples',
                    name: 'Chat Examples',
                    system_prompt: true,
                    marker: true
                },
                {
                    name: 'Post-History Instructions',
                    system_prompt: true,
                    role: 'system',
                    content: '',
                    identifier: 'jailbreak'
                },
                {
                    identifier: 'chatHistory',
                    name: 'Chat History',
                    system_prompt: true,
                    marker: true
                },
                {
                    identifier: 'worldInfoAfter',
                    name: 'World Info (after)',
                    system_prompt: true,
                    marker: true
                },
                {
                    identifier: 'worldInfoBefore',
                    name: 'World Info (before)',
                    system_prompt: true,
                    marker: true
                },
                {
                    identifier: 'enhanceDefinitions',
                    role: 'system',
                    name: 'Enhance Definitions',
                    content: 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.',
                    system_prompt: true,
                    marker: false
                },
                {
                    identifier: 'charDescription',
                    name: 'Char Description',
                    system_prompt: true,
                    marker: true
                },
                {
                    identifier: 'charPersonality',
                    name: 'Char Personality',
                    system_prompt: true,
                    marker: true
                },
                {
                    identifier: 'scenario',
                    name: 'Scenario',
                    system_prompt: true,
                    marker: true
                },
                {
                    identifier: 'personaDescription',
                    name: 'Persona Description',
                    system_prompt: true,
                    marker: true
                }
            ];
            
            const defaultPromptOrder = [
                {
                    character_id: 100001,
                    order: [
                        { identifier: 'main', enabled: true },
                        { identifier: 'worldInfoBefore', enabled: true },
                        { identifier: 'charDescription', enabled: true },
                        { identifier: 'charPersonality', enabled: true },
                        { identifier: 'scenario', enabled: true },
                        { identifier: 'enhanceDefinitions', enabled: false },
                        { identifier: 'nsfw', enabled: true },
                        { identifier: 'worldInfoAfter', enabled: true },
                        { identifier: 'dialogueExamples', enabled: true },
                        { identifier: 'chatHistory', enabled: true },
                        { identifier: 'jailbreak', enabled: true }
                    ]
                }
            ];
            
            // 프리셋에서 prompts와 prompt_order를 가져올 수 있는지 확인
            let prompts = settings.prompts && settings.prompts.length > 0 
                ? settings.prompts 
                : defaultPrompts;
            
            let prompt_order = settings.prompt_order && settings.prompt_order.length > 0
                ? settings.prompt_order
                : defaultPromptOrder;
            
            // 현재 선택된 프리셋이 있으면 프리셋에서 prompts/prompt_order 확인
            const currentPresetName = settings.preset_settings_openai;
            if (currentPresetName && currentPresetName !== 'Default' && currentPresetName !== 'gui') {
                try {
                    // PresetManager를 찾거나 생성
                    const presetSelect = panelContainer.querySelector('#settings_preset_openai');
                    if (presetSelect) {
                        // registerPresetManager - 전역 스코프에서 사용
                        const manager = registerPresetManager(presetSelect, 'openai');
                        const { presets, preset_names } = await manager.getPresetList();
                    const presetIndex = preset_names[currentPresetName];
                    if (presetIndex !== undefined && presets[presetIndex]) {
                        const currentPreset = presets[presetIndex];
                        // 프리셋에 prompts/prompt_order가 있으면 사용
                        if (currentPreset.prompts !== undefined && Array.isArray(currentPreset.prompts) && currentPreset.prompts.length > 0) {
                            prompts = currentPreset.prompts;
                        }
                        if (currentPreset.prompt_order !== undefined && Array.isArray(currentPreset.prompt_order) && currentPreset.prompt_order.length > 0) {
                            prompt_order = currentPreset.prompt_order;
                            }
                        }
                    }
                } catch (error) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_PROMPT_20023', '프리셋에서 프롬프트 불러오기 실패', error);
                    }
                }
            }
            
            // prompt_order에 dummyId(100001)가 없으면 추가
            const hasDummyId = prompt_order.some(order => order.character_id === 100001);
            if (!hasDummyId) {
                prompt_order = [...prompt_order, ...defaultPromptOrder];
            }
            
            const serviceSettings = {
                prompts: prompts,
                prompt_order: prompt_order,
            };
            
            // PromptManager 초기화
            await promptManager.init({
                containerIdentifier: 'completion_prompt_manager',
                listIdentifier: 'completion_prompt_manager_list',
                prefix: 'completion_',
                promptOrder: {
                    strategy: 'global',
                    dummyId: 100001, // 실리태번과 동일한 더미 ID
                },
                toggleDisabled: [],
                sortableDelay: 30,
                warningTokenThreshold: 1500,
                dangerTokenThreshold: 500,
            }, serviceSettings);
            
            // 전역 변수에 PromptManager 인스턴스 저장 (applyPresetToUI에서 사용)
            window.promptManagerInstance = promptManager;

            // 토큰 계산을 모달이 열릴 때만 수행하도록 설정
            // 모달이 열릴 때마다 계산하되, 같은 모달 세션에서는 중복 계산 방지
            
            // tryGenerate 콜백 설정 (실리태번과 동일)
            // 단, 모달이 열릴 때만 토큰 계산 수행
            const originalTryGenerate = promptManager.tryGenerate;
            promptManager.tryGenerate = async () => {
                // ⚠️ 중요: 캐릭터 ID는 chatManager.currentCharacterId만 사용
                // CharacterStorage.loadCurrent()는 사용하지 않음 (잘못된 캐릭터로 연결되는 문제 방지)
                // 이유: 프롬프트 모달을 열었다 닫으면 다른 캐릭터로 연결되는 문제 방지
                
                // ChatManager에서 현재 캐릭터 ID 가져오기 (유일한 소스)
                let currentCharacterId = null;
                try {
                    if (typeof window !== 'undefined' && window.chatManager) {
                        currentCharacterId = window.chatManager.currentCharacterId;
                    }
                } catch (e) {
                    // chatManager에 접근할 수 없으면 무시
                }
                
                // ⚠️ 중요: CharacterStorage.loadCurrent()를 사용하지 않음
                // chatManager.currentCharacterId가 없으면 건너뛰기
                // 캐릭터가 선택되어 있지 않으면 건너뛰기
                if (!currentCharacterId) {
                    return;
                }

                const character = await CharacterStorage.load(currentCharacterId);
                if (!character) {
                    return;
                }

                // prepareOpenAIMessages를 dryRun=true로 호출하여 토큰 계산
                // prepareOpenAIMessagesFromCharacter - 전역 스코프에서 사용
                const settings = await SettingsStorage.load();
                
                // activeCharacter 설정 (토큰 계산용)
                promptManager.activeCharacter = { ...character, id: currentCharacterId };
                
                // 토큰 카운팅 함수 생성 (실리태번과 동일)
                // promptManager.countTokensAsync 사용
                const tokenCountFn = async (message) => {
                    try {
                        // promptManager.countTokensAsync 사용 (실제 토큰 계산)
                        const result = await promptManager.countTokensAsync(message, true);
                        return result;
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_TOKEN_15012', '프롬프트 패널 tokenCountFn 오류', error);
                        }
                        // 폴백: 간단한 추정
                        if (Array.isArray(message)) {
                            return message.reduce((total, msg) => {
                                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || {});
                                return total + Math.ceil(content.length / 4);
                            }, 0);
                        }
                        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content || {});
                        return Math.ceil(content.length / 4);
                    }
                };
                
                try {
                    // ChatHistory 가져오기 (현재 채팅 메시지들)
                    // ChatManager - 전역 스코프에서 사용
                    let chatHistoryMessages = [];
                    if (window.chatManager && typeof window.chatManager.getChatHistory === 'function') {
                        chatHistoryMessages = window.chatManager.getChatHistory();
                    }
                    
                    const [messages, success] = await prepareOpenAIMessagesFromCharacter(
                        {
                            character,
                            chatMetadata: {},
                            name1: 'User',
                            name2: character.name || 'Character',
                            additionalOptions: {
                                messages: chatHistoryMessages, // 채팅 히스토리 전달
                            },
                        },
                        true, // dryRun = true
                        promptManager,
                        {
                            openai_max_context: settings.openai_max_context || 4095,
                            openai_max_tokens: settings.openai_max_tokens || 300,
                            temp_openai: settings.temp_openai || 1.0,
                            freq_pen_openai: settings.freq_pen_openai || 0.0,
                            pres_pen_openai: settings.pres_pen_openai || 0.0,
                            top_p_openai: settings.top_p_openai || 1.0,
                            persona_description: settings.persona_description || '',
                            persona_description_position: settings.persona_description_position ?? 0,
                            squash_system_messages: settings.squash_system_messages !== false,
                        },
                        tokenCountFn // 토큰 카운팅 함수 전달
                    );
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_PROMPT_8007', '메시지 준비 오류 (tryGenerate)', error);
                    }
                }
            };
            
            // 모달이 열릴 때 토큰 계산 트리거 (모달이 열릴 때마다)
            // tryGenerate를 비동기로 호출 (모달 렌더링이 완료된 후)
            // 모달이 열릴 때마다 계산 수행
            setTimeout(async () => {
                try {
                    await promptManager.tryGenerate();
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_PROMPT_8008', '모달 열기 시 토큰 계산 오류', error);
                    }
                }
            }, 500); // 모달 렌더링 완료 대기

            // saveServiceSettings 콜백 설정
            promptManager.saveServiceSettings = async () => {
                const currentSettings = await SettingsStorage.load();
                const updatedSettings = {
                    ...currentSettings,
                    prompts: promptManager.serviceSettings.prompts || [],
                    prompt_order: promptManager.serviceSettings.prompt_order || [],
                };
                
                // dummyId(100001)에 해당하는 prompt_order 찾기
                const dummyIdOrderEntry = updatedSettings.prompt_order?.find(e => String(e.character_id) === '100001');
                
                if (dummyIdOrderEntry) {
                    const first5Identifiers = dummyIdOrderEntry.order?.slice(0, 5).map(o => o.identifier);
                    const fullOrderIdentifiers = dummyIdOrderEntry.order?.map(o => o.identifier);
                    
                    console.log('[saveServiceSettings] Saving prompt_order:');
                    console.log('  - count:', updatedSettings.prompt_order?.length);
                    console.log('  - character_id:', dummyIdOrderEntry.character_id);
                    console.log('  - orderLength:', dummyIdOrderEntry.order?.length);
                    console.log('  - first5Identifiers:', first5Identifiers);
                    console.log('  - fullOrderIdentifiers:', fullOrderIdentifiers);
                } else {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_PROMPT_20024', 'dummyId order entry를 찾을 수 없음');
                    }
                    console.log('[saveServiceSettings] Available character_ids:', updatedSettings.prompt_order?.map(e => e.character_id));
                }
                
                await SettingsStorage.save(updatedSettings);
                
                // 저장 확인
                const savedSettings = await SettingsStorage.load();
                const savedDummyIdOrderEntry = savedSettings.prompt_order?.find(e => String(e.character_id) === '100001');
                
                if (savedDummyIdOrderEntry) {
                    const savedFirst5Identifiers = savedDummyIdOrderEntry.order?.slice(0, 5).map(o => o.identifier);
                    const savedFullOrderIdentifiers = savedDummyIdOrderEntry.order?.map(o => o.identifier);
                    const originalOrderIds = dummyIdOrderEntry?.order?.map(o => o.identifier);
                    const matchesOriginal = JSON.stringify(originalOrderIds) === JSON.stringify(savedFullOrderIdentifiers);
                    
                    console.log('[saveServiceSettings] Saved prompt_order verified:');
                    console.log('  - count:', savedSettings.prompt_order?.length);
                    console.log('  - character_id:', savedDummyIdOrderEntry.character_id);
                    console.log('  - orderLength:', savedDummyIdOrderEntry.order?.length);
                    console.log('  - first5Identifiers:', savedFirst5Identifiers);
                    console.log('  - matchesOriginal:', matchesOriginal);
                    console.log('  - fullOrderIdentifiers:', savedFullOrderIdentifiers);
                } else {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_PROMPT_20025', '저장된 dummyId order entry를 찾을 수 없음');
                    }
                    console.log('[saveServiceSettings] Available character_ids:', savedSettings.prompt_order?.map(e => e.character_id));
                }
                
                console.log('Prompt settings saved to IndexedDB');
            };

            // 렌더링
            await promptManager.render();
            
            // Quick Edit 필드에 현재 프롬프트 내용 로드
            const mainPrompt = promptManager.getPromptById('main');
            const nsfwPrompt = promptManager.getPromptById('nsfw');
            const jailbreakPrompt = promptManager.getPromptById('jailbreak');
            
            const mainQuickEdit = panelContainer.querySelector('#main_prompt_quick_edit_textarea');
            const nsfwQuickEdit = panelContainer.querySelector('#nsfw_prompt_quick_edit_textarea');
            const jailbreakQuickEdit = panelContainer.querySelector('#jailbreak_prompt_quick_edit_textarea');
            
            if (mainQuickEdit && mainPrompt) {
                mainQuickEdit.value = mainPrompt.content || '';
            }
            if (nsfwQuickEdit && nsfwPrompt) {
                nsfwQuickEdit.value = nsfwPrompt.content || '';
            }
            if (jailbreakQuickEdit && jailbreakPrompt) {
                jailbreakQuickEdit.value = jailbreakPrompt.content || '';
            }
        }
    
    // 설정 모달의 chat-completion-source select 변경 감지
    const chatCompletionSourceSelectForEvent = document.getElementById('chat-completion-source');
    if (chatCompletionSourceSelectForEvent) {
        // 중복 등록 방지
        if (!chatCompletionSourceSelectForEvent._hasPromptsChangeHandler) {
            chatCompletionSourceSelectForEvent._hasPromptsChangeHandler = true;
        chatCompletionSourceSelectForEvent.addEventListener('change', async () => {
                // SettingsManager의 change 핸들러가 saveSettings를 호출하므로
                // 여기서는 저장 후 바로 업데이트
                // 짧은 지연을 주어 SettingsManager의 saveSettings가 완료되도록 함
                await new Promise(resolve => setTimeout(resolve, 50));
            await handleApiProviderChange();
            // API 변경 시 모델도 다시 확인
            const newSettings = await SettingsStorage.load();
            const newApiProvider = newSettings.apiProvider || 'openai';
            await handleModelChange(panelContainer, newApiProvider);
        });
        }
    }
    
    // API Provider 변경 이벤트 감지 (설정 모달에서 변경될 때)
    // 패널별로 독립적인 핸들러 사용 (여러 패널이 열릴 수 있음)
    const apiProviderChangedHandler = async (event) => {
        const apiProvider = event.detail?.apiProvider;
        if (apiProvider) {
            // 디버깅: API Provider 변경 확인
            console.debug('[promptsTemplatesPanel] API Provider 변경됨:', apiProvider);
            
            // 짧은 지연을 주어 SettingsManager의 saveSettings가 완료되도록 함
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // 설정에서 최신 API Provider 확인 (이벤트 값과 다를 수 있음)
            const settings = await SettingsStorage.load();
            const actualApiProvider = settings.apiProvider || apiProvider;
            
            // 필드 업데이트
            await handleApiProviderChange();
            
            // 디버깅: 필드 업데이트 후 확인
            console.debug('[promptsTemplatesPanel] 필드 업데이트 완료, API Provider:', actualApiProvider);
            
            await handleModelChange(panelContainer, actualApiProvider);
        }
    };
    
    // 패널이 열릴 때마다 이벤트 리스너 등록 (패널별로 독립적으로)
    window.addEventListener('api-provider-changed', apiProviderChangedHandler);
    
    // 패널이 닫힐 때 리스너 제거를 위한 참조 저장 (나중에 구현 가능)
    if (!panelContainer._apiProviderChangedHandler) {
        panelContainer._apiProviderChangedHandler = apiProviderChangedHandler;
    }
    
    // 모델 선택 변경 감지 (각 API Provider별)
    const chatCompletionApis = ['openai', 'claude', 'openrouter', 'ai21', 'makersuite', 'vertexai', 
                                 'mistralai', 'custom', 'cohere', 'perplexity', 'groq', 'electronhub', 
                                 'nanogpt', 'deepseek', 'xai', 'pollinations', 'moonshot', 'fireworks', 
                                 'cometapi', 'azure_openai', 'zai'];
    
    chatCompletionApis.forEach(apiProvider => {
        const modelSelectId = `model_${apiProvider}_select`;
        const modelSelect = document.getElementById(modelSelectId);
        if (modelSelect) {
            modelSelect.addEventListener('change', async () => {
                const currentSettings = await SettingsStorage.load();
                const currentApiProvider = currentSettings.apiProvider || 'openai';
                // 현재 선택된 API와 모델이 변경된 API가 같은 경우에만 업데이트
                if (currentApiProvider === apiProvider || apiProvider === 'openai') {
                    await handleModelChange(panelContainer, currentApiProvider);
                }
            });
        }
    });
    
    // 주기적으로 확인 (설정 모달 외부에서 변경될 수도 있음)
    // 또는 이벤트 전파를 사용하는 것이 더 나을 수 있음
    window.addEventListener('settings-updated', async () => {
        await handleApiProviderChange();
        const newSettings = await SettingsStorage.load();
        const newApiProvider = newSettings.apiProvider || 'openai';
        await handleModelChange(panelContainer, newApiProvider);
    });
    
    // 설정 변경 시 자동 저장 (디바운스)
    let saveTimeout;
    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            await saveGenerationSettings(panelContainer);
        }, 500);
    };
    
    // Chat Settings 이벤트 핸들러
    // Character Name Action 라디오 버튼
    const characterNamesRadios = panelContainer.querySelectorAll('input[name="character_names"]');
    const namesBehaviorHidden = panelContainer.querySelector('#names_behavior');
    const characterNamesDisplay = panelContainer.querySelector('#character_names_display');
    characterNamesRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (namesBehaviorHidden) {
                namesBehaviorHidden.value = value;
            }
            
            // Display 업데이트
            if (characterNamesDisplay) {
                if (value === -1) characterNamesDisplay.textContent = '(없음)';
                else if (value === 0) characterNamesDisplay.textContent = '(기본값)';
                else if (value === 1) characterNamesDisplay.textContent = '(Completion Object)';
                else if (value === 2) characterNamesDisplay.textContent = '(Message Content)';
            }
            
            debouncedSave();
        });
    });
    
    // Continue Postfix 라디오 버튼
    const continuePostfixRadios = panelContainer.querySelectorAll('input[name="continue_postfix"]');
    const continuePostfixHidden = panelContainer.querySelector('#continue_postfix');
    const continuePostfixDisplay = panelContainer.querySelector('#continue_postfix_display');
    continuePostfixRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (continuePostfixHidden) {
                continuePostfixHidden.value = value;
            }
            
            // Display 업데이트
            if (continuePostfixDisplay) {
                if (value === 0) continuePostfixDisplay.textContent = '(없음)';
                else if (value === 1) continuePostfixDisplay.textContent = '(공백)';
                else if (value === 2) continuePostfixDisplay.textContent = '(새 줄)';
                else if (value === 3) continuePostfixDisplay.textContent = '(이중 줄)';
            }
            
            debouncedSave();
        });
    });
    
    // 모든 입력 필드에 변경 이벤트 리스너 추가
    // 컨텍스트 잠금 해제 체크박스는 loadGenerationSettings에서 이미 처리됨
    // SettingsStorage는 이미 함수 상단에서 import됨
    // 현재 API Provider 가져오기 (안전하게)
    const settingsForFieldMapping = await SettingsStorage.load();
    const currentApiProviderForFields = settingsForFieldMapping.apiProvider || 'openai';
    const fieldMapping = getApiFieldMapping(currentApiProviderForFields);
    
    const allInputs = panelContainer.querySelectorAll('input[type="text"], input[type="number"], textarea, select, input[type="checkbox"], input[type="range"]');
    allInputs.forEach(input => {
        // 컨텍스트 잠금 해제 체크박스, 라디오 버튼, Quick Edit 필드는 제외 (이미 처리됨)
        const isQuickEdit = input.id === 'main_prompt_quick_edit_textarea' || 
                           input.id === 'nsfw_prompt_quick_edit_textarea' || 
                           input.id === 'jailbreak_prompt_quick_edit_textarea';
        if (input.id !== fieldMapping.contextUnlockedField && 
            input.type !== 'radio' && 
            !input.name?.includes('character_names') && 
            !input.name?.includes('continue_postfix') &&
            !isQuickEdit) {
            input.addEventListener('input', debouncedSave);
            input.addEventListener('change', debouncedSave);
        }
    });
    
    // Quick Edit 이벤트 핸들러 (PromptManager와 연동)
    // 실리태번 방식: blur 이벤트에서 PromptManager 업데이트 및 저장
    const mainQuickEdit = panelContainer.querySelector('#main_prompt_quick_edit_textarea');
    const nsfwQuickEdit = panelContainer.querySelector('#nsfw_prompt_quick_edit_textarea');
    const jailbreakQuickEdit = panelContainer.querySelector('#jailbreak_prompt_quick_edit_textarea');
    
    // Quick Edit 필드의 blur 이벤트 핸들러 (실리태번과 동일)
    // 실리태번 방식: data-pm-prompt 속성에서 promptId 가져오기
    const handleQuickEditSave = async (event) => {
        if (!window.promptManagerInstance) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20026', 'PromptManager 인스턴스를 찾을 수 없음 (QuickEdit)');
            }
            return;
        }
        
        const promptId = event.target.dataset.pmPrompt;
        if (!promptId) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20027', 'data-pm-prompt 속성을 찾을 수 없음');
            }
            return;
        }
        
        const promptManager = window.promptManagerInstance;
        const prompt = promptManager.getPromptById(promptId);
        
        if (!prompt) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20028', `프롬프트를 찾을 수 없음 (QuickEdit): ${promptId}`);
            }
            return;
        }
        
        // 프롬프트 내용 업데이트 (실리태번과 동일)
        prompt.content = event.target.value;
        
        // 편집 폼이 열려있으면 그 값도 업데이트 (실리태번과 동일)
        const popupEditFormPrompt = document.getElementById(promptManager.configuration?.prefix + 'prompt_manager_popup_entry_form_prompt');
        if (popupEditFormPrompt && popupEditFormPrompt.offsetParent) {
            popupEditFormPrompt.value = prompt.content;
        }
        
        // PromptManager 업데이트 및 저장
        console.log('[setupPromptsPanelEvents] Quick Edit saved for prompt:', promptId);
        
        // saveServiceSettings 호출 (SettingsStorage에 저장)
        // 실리태번: saveServiceSettings().then(() => this.render())
        if (promptManager.saveServiceSettings) {
            await promptManager.saveServiceSettings();
            // 저장 후 리렌더링
            if (promptManager.render) {
                promptManager.render();
            }
        }
    };
    
    // 실리태번 방식: blur 이벤트에서만 저장 (input 이벤트로는 저장하지 않음)
    if (mainQuickEdit) {
        mainQuickEdit.addEventListener('blur', handleQuickEditSave);
    }
    
    if (nsfwQuickEdit) {
        nsfwQuickEdit.addEventListener('blur', handleQuickEditSave);
    }
    
    if (jailbreakQuickEdit) {
        jailbreakQuickEdit.addEventListener('blur', handleQuickEditSave);
    }
    
    // 복원 버튼 이벤트 구현
    const restoreButtons = panelContainer.querySelectorAll('[id$="_restore"]');
    restoreButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const buttonId = button.id;
            let defaultValue = '';
            let targetTextareaId = '';
            
            // 버튼 ID에 따라 기본값과 대상 textarea 결정 (presetManager.js의 기본값 사용)
            if (buttonId === 'impersonation_prompt_restore') {
                defaultValue = '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]';
                targetTextareaId = 'impersonation_prompt_textarea';
            } else if (buttonId === 'wi_format_restore') {
                defaultValue = '{0}';
                targetTextareaId = 'wi_format_textarea';
            } else if (buttonId === 'scenario_format_restore') {
                defaultValue = '{{scenario}}';
                targetTextareaId = 'scenario_format_textarea';
            } else if (buttonId === 'personality_format_restore') {
                defaultValue = '{{personality}}';
                targetTextareaId = 'personality_format_textarea';
            } else if (buttonId === 'group_nudge_prompt_restore') {
                defaultValue = '[Write the next reply only as {{char}}.]';
                targetTextareaId = 'group_nudge_prompt_textarea';
            } else if (buttonId === 'newchat_prompt_restore') {
                defaultValue = '[Start a new Chat]';
                targetTextareaId = 'newchat_prompt_textarea';
            } else if (buttonId === 'newgroupchat_prompt_restore') {
                defaultValue = '[Start a new group chat. Group members: {{group}}]';
                targetTextareaId = 'newgroupchat_prompt_textarea';
            } else if (buttonId === 'newexamplechat_prompt_restore') {
                defaultValue = '[Example Chat]';
                targetTextareaId = 'newexamplechat_prompt_textarea';
            } else if (buttonId === 'continue_nudge_prompt_restore') {
                defaultValue = '[Continue your last message without repeating its original content.]';
                targetTextareaId = 'continue_nudge_prompt_textarea';
            }
            
            if (targetTextareaId) {
                const textarea = panelContainer.querySelector(`#${targetTextareaId}`);
                if (textarea) {
                    textarea.value = defaultValue;
                    // 설정 저장
                    await saveGenerationSettings(panelContainer);
                }
            }
        });
    });
}

// 전역 스코프에 노출
if (typeof window !== 'undefined') {
    window.createPromptsPanel = createPromptsPanel;
}

