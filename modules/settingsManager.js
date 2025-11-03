/**
 * 설정 관리 모듈
 * 설정 로드/저장, 설정 모달 관리
 * 실리태번 구조와 동일하게 구현
 */


class SettingsManager {
    constructor(elements) {
        this.elements = elements;
        this.setupEventListeners();
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 설정 닫기 버튼
        if (this.elements.closeSettingsBtn) {
            this.elements.closeSettingsBtn.addEventListener('click', () => {
                this.saveSettings();
                this.closeSettingsModal();
            });
        }
        
        // 설정 모달 컨텐츠 클릭 시 이벤트 전파 중지
        if (this.elements.settingsModal) {
            const modalContent = this.elements.settingsModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }

        // Chat Completion Source 변경 시 UI 토글 및 모델 목록 업데이트
        const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
        if (chatCompletionSourceSelect) {
            chatCompletionSourceSelect.addEventListener('change', () => {
                this.toggleProviderSpecificSettings();
                this.updateModelOptions();
            });
        }

        // Google Vertex AI Authentication Mode 변경 시 Express/Full 설정 토글
        const vertexaiAuthModeSelect = document.getElementById('vertexai_auth_mode');
        if (vertexaiAuthModeSelect) {
            vertexaiAuthModeSelect.addEventListener('change', () => {
                this.toggleVertexAIAuthMode();
            });
        }

        // Google Vertex AI Service Account JSON Validate 버튼
        const vertexaiValidateBtn = document.getElementById('vertexai_validate_service_account');
        if (vertexaiValidateBtn) {
            vertexaiValidateBtn.addEventListener('click', () => {
                this.validateVertexAIServiceAccount();
            });
        }

        // Connect 버튼
        const connectButton = document.getElementById('api_connect_button');
        if (connectButton) {
            connectButton.addEventListener('click', () => {
                this.onConnectButtonClick();
            });
        }

        // Test Message 버튼
        const testButton = document.getElementById('api_test_button');
        if (testButton) {
            testButton.addEventListener('click', () => {
                this.onTestMessageClick();
            });
        }
    }

    /**
     * Google Vertex AI Authentication Mode 토글
     */
    toggleVertexAIAuthMode() {
        const authModeSelect = document.getElementById('vertexai_auth_mode');
        if (!authModeSelect) return;

        const authMode = authModeSelect.value;
        const expressConfig = document.getElementById('vertexai_express_config');
        const fullConfig = document.getElementById('vertexai_full_config');

        if (authMode === 'express') {
            if (expressConfig) {
                expressConfig.style.display = 'block';
            }
            if (fullConfig) {
                fullConfig.style.display = 'none';
            }
        } else if (authMode === 'full') {
            if (expressConfig) {
                expressConfig.style.display = 'none';
            }
            if (fullConfig) {
                fullConfig.style.display = 'block';
            }
        }
    }

    /**
     * Google Vertex AI Service Account JSON 검증
     */
    async validateVertexAIServiceAccount() {
        const jsonInput = document.getElementById('vertexai_service_account_json');
        const statusDiv = document.getElementById('vertexai_service_account_status');
        const infoSpan = document.getElementById('vertexai_service_account_info');
        
        if (!jsonInput || !statusDiv || !infoSpan) return;

        const jsonContent = jsonInput.value.trim();
        if (!jsonContent) {
            showToast('Please enter Service Account JSON content', 'warning');
            return;
        }

        try {
            const serviceAccount = JSON.parse(jsonContent);
            const requiredFields = ['type', 'project_id', 'private_key', 'client_email', 'client_id'];
            const missingFields = requiredFields.filter(field => !serviceAccount[field]);

            if (missingFields.length > 0) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'info-block error';
                infoSpan.textContent = `Missing required fields: ${missingFields.join(', ')}`;
                showToast(`Missing required fields: ${missingFields.join(', ')}`, 'error');
                return;
            }

            if (serviceAccount.type !== 'service_account') {
                statusDiv.style.display = 'block';
                statusDiv.className = 'info-block error';
                infoSpan.textContent = 'Invalid service account type. Expected "service_account"';
                showToast('Invalid service account type. Expected "service_account"', 'error');
                return;
            }

            // 성공 상태 표시
            statusDiv.style.display = 'block';
            statusDiv.className = 'info-block success';
            infoSpan.textContent = `Project: ${serviceAccount.project_id}, Email: ${serviceAccount.client_email}`;
            
            showToast('Service Account JSON is valid', 'success');
            this.saveSettings();
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_UI_13003', 'JSON 검증 오류', error);
            }
            statusDiv.style.display = 'block';
            statusDiv.className = 'info-block error';
            infoSpan.textContent = 'Invalid JSON format';
            showToast('Invalid JSON format', 'error');
        }
    }

    /**
     * 설정 모달 열기
     */
    async openSettingsModal() {
        // 오버레이 먼저 표시 (메뉴가 열려있어도 오버레이 유지)
        this.elements.overlay.classList.remove('hidden', 'closing');
        this.elements.overlay.style.pointerEvents = '';
        
        // 사이드 메뉴가 열려있으면 닫기 (오버레이는 유지)
        const sideMenu = document.getElementById('side-menu');
        if (sideMenu && !sideMenu.classList.contains('hidden')) {
            sideMenu.classList.add('closing');
            sideMenu.style.pointerEvents = 'none';
            
            // 메뉴 닫기 애니메이션
            const handleTransitionEnd = (e) => {
                if (e.propertyName !== 'transform') return;
                sideMenu.removeEventListener('transitionend', handleTransitionEnd);
                sideMenu.classList.remove('closing');
                sideMenu.classList.add('hidden');
                sideMenu.style.pointerEvents = '';
                sideMenu.style.transform = '';
            };
            
            sideMenu.addEventListener('transitionend', handleTransitionEnd);
        }
        
        // 설정 모달 표시
        this.elements.settingsModal.classList.remove('closing', 'hidden');
        this.elements.settingsModal.style.pointerEvents = '';
        
        // 설정 로드 및 UI 업데이트
        await this.loadSettings();
        
        // 모달 배경 클릭 시 닫기
        const existingHandler = this.elements.settingsModal._clickHandler;
        if (existingHandler) {
            this.elements.settingsModal.removeEventListener('click', existingHandler);
        }
        
        this.elements.settingsModal._clickHandler = (e) => {
            if (e.target.closest('.modal-content')) {
                e.stopPropagation();
                return;
            }
            this.saveSettings();
            this.closeSettingsModal();
        };
        this.elements.settingsModal.addEventListener('click', this.elements.settingsModal._clickHandler);
    }

    /**
     * 설정 모달 닫기
     */
    closeSettingsModal() {
        if (this.elements.settingsModal.classList.contains('closing')) {
            return;
        }
        
        this.elements.settingsModal.classList.add('closing');
        this.elements.overlay.classList.add('closing');
        this.elements.settingsModal.style.pointerEvents = 'none';
        
        const panelContainer = document.getElementById('panel-modal-container');
        const sideMenuOpen = !this.elements.sideMenu.classList.contains('hidden');
        
        // 오버레이 정리 함수
        const cleanupOverlay = () => {
            if (!panelContainer && !sideMenuOpen) {
                // 다른 모달이 없으면 오버레이 완전히 숨김
                this.elements.overlay.classList.remove('closing');
                this.elements.overlay.classList.add('hidden');
                this.elements.overlay.style.pointerEvents = 'none';
            } else {
                // 다른 모달이 있으면 오버레이 유지하되 클릭 가능하도록 복원
                this.elements.overlay.classList.remove('closing');
                this.elements.overlay.style.pointerEvents = '';
            }
        };
        
        let animationHandled = false;
        const handleAnimationEnd = () => {
            if (animationHandled) return;
            animationHandled = true;
            
            this.elements.settingsModal.removeEventListener('animationend', handleAnimationEnd);
            this.elements.settingsModal.classList.remove('closing');
            this.elements.settingsModal.classList.add('hidden');
            this.elements.settingsModal.style.pointerEvents = '';
            
            // 오버레이 정리
            if (!panelContainer && !sideMenuOpen) {
                // 오버레이 애니메이션 완료 대기
                const handleOverlayEnd = () => {
                    this.elements.overlay.removeEventListener('animationend', handleOverlayEnd);
                    cleanupOverlay();
                };
                this.elements.overlay.addEventListener('animationend', handleOverlayEnd);
                
                // 타임아웃으로 강제 정리 (최대 500ms 후)
                setTimeout(() => {
                    this.elements.overlay.removeEventListener('animationend', handleOverlayEnd);
                    cleanupOverlay();
                }, 500);
            } else {
                cleanupOverlay();
            }
        };
        
        this.elements.settingsModal.addEventListener('animationend', handleAnimationEnd);
        
        // 타임아웃으로 강제 정리 (최대 500ms 후)
        setTimeout(() => {
            if (!animationHandled) {
                animationHandled = true;
                this.elements.settingsModal.removeEventListener('animationend', handleAnimationEnd);
                this.elements.settingsModal.classList.remove('closing');
                this.elements.settingsModal.classList.add('hidden');
                this.elements.settingsModal.style.pointerEvents = '';
                cleanupOverlay();
            }
        }, 500);
    }

    /**
     * 설정 로드
     */
    async loadSettings() {
        const settings = await SettingsStorage.load();
        
        // PresetManager 초기화 (OpenAI용)
        await this.initPresetManager();
        
        const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
        
        // Chat Completion Source 설정
        const provider = settings.apiProvider || 'openai';
        if (chatCompletionSourceSelect) {
            chatCompletionSourceSelect.value = provider;
        }

        // 제공업체별 API 키 필드 ID 매핑 (실리태번 ID 형식)
        const providerKeyMap = {
            'openai': 'api_key_openai',
            'claude': 'api_key_claude',
            'openrouter': 'api_key_openrouter',
            'ai21': 'api_key_ai21',
            'makersuite': 'api_key_makersuite',
            'vertexai': 'api_key_vertexai',
            'mistralai': 'api_key_mistralai',
            'custom': 'api_key_custom',
            'cohere': 'api_key_cohere',
            'perplexity': 'api_key_perplexity',
            'groq': 'api_key_groq',
            'electronhub': 'api_key_electronhub',
            'nanogpt': 'api_key_nanogpt',
            'deepseek': 'api_key_deepseek',
            'aimlapi': 'api_key_aimlapi',
            'xai': 'api_key_xai',
            'pollinations': null, // Pollinations는 API 키 없음
            'moonshot': 'api_key_moonshot',
            'fireworks': 'api_key_fireworks',
            'cometapi': 'api_key_cometapi',
            'azure_openai': 'api_key_azure_openai',
            'zai': 'api_key_zai',
        };
        
        // 모든 제공업체의 API 키 입력 필드에 값 설정
        const apiKeys = settings.apiKeys || {};
        Object.keys(providerKeyMap).forEach(providerKey => {
            const inputId = providerKeyMap[providerKey];
            if (inputId) {
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = apiKeys[providerKey] || '';
                }
            }
        });
        
        // 제공업체별 설정 UI 토글
        this.toggleProviderSpecificSettings();
        
        // 모델 목록 업데이트
        this.updateModelOptions();
        
        // 모든 제공업체의 모델 필드에 값 설정
        const apiModels = settings.apiModels || {};
        const providerModelMap = {
            'openai': 'model_openai_select',
            'claude': 'model_claude_select',
            'openrouter': 'model_openrouter_select',
            'ai21': 'model_ai21_select',
            'makersuite': 'model_makersuite_select',
            'vertexai': 'model_vertexai_select',
            'mistralai': 'model_mistralai_select',
            'custom': 'model_custom_select',
            'cohere': 'model_cohere_select',
            'perplexity': 'model_perplexity_select',
            'groq': 'model_groq_select',
            'electronhub': 'model_electronhub_select',
            'nanogpt': 'model_nanogpt_select',
            'deepseek': 'model_deepseek_select',
            'aimlapi': 'model_aimlapi_select',
            'xai': 'model_xai_select',
            'pollinations': 'model_pollinations_select',
            'moonshot': 'model_moonshot_select',
            'fireworks': 'model_fireworks_select',
            'cometapi': 'model_cometapi_select',
            'azure_openai': 'model_azure_openai_select',
            'zai': 'model_zai_select',
        };
        
        Object.keys(providerModelMap).forEach(providerKey => {
            const selectId = providerModelMap[providerKey];
            const select = document.getElementById(selectId);
            if (select) {
                const model = apiModels[providerKey] || '';
                if (model) {
                    select.value = model;
                }
            }
        });
        
        // Azure OpenAI 설정 로드
        const azureBaseUrl = document.getElementById('azure_base_url');
        const azureDeploymentName = document.getElementById('azure_deployment_name');
        const azureApiVersion = document.getElementById('azure_api_version');
        
        if (azureBaseUrl) azureBaseUrl.value = settings.azure_base_url || '';
        if (azureDeploymentName) azureDeploymentName.value = settings.azure_deployment_name || '';
        if (azureApiVersion) azureApiVersion.value = settings.azure_api_version || '2025-04-01-preview';
        
        // Custom API 설정 로드
        const customUrl = document.getElementById('custom_api_url_text');
        if (customUrl) customUrl.value = settings.custom_url || '';
        
        const customModelId = document.getElementById('custom_model_id');
        if (customModelId) customModelId.value = settings.custom_model_id || '';
        
        const azureModel = document.getElementById('azure_openai_model');
        if (azureModel) azureModel.value = settings.apiModels?.azure_openai || '';

        // OpenAI 추가 설정 로드
        const openaiBypassStatusCheck = document.getElementById('openai_bypass_status_check');
        if (openaiBypassStatusCheck) openaiBypassStatusCheck.checked = settings.openai_bypass_status_check || false;
        
        const openaiShowExternalModels = document.getElementById('openai_show_external_models');
        if (openaiShowExternalModels) openaiShowExternalModels.checked = settings.openai_show_external_models || false;

        // Google Vertex AI 설정 로드
        const vertexaiAuthMode = document.getElementById('vertexai_auth_mode');
        if (vertexaiAuthMode) {
            vertexaiAuthMode.value = settings.vertexai_auth_mode || 'express';
            // 설정 로드 후 인증 모드에 따라 UI 토글
            setTimeout(() => {
                this.toggleVertexAIAuthMode();
            }, 0);
        }
        
        const vertexaiExpressProjectId = document.getElementById('vertexai_express_project_id');
        if (vertexaiExpressProjectId) vertexaiExpressProjectId.value = settings.vertexai_express_project_id || '';
        
        const vertexaiServiceAccountJson = document.getElementById('vertexai_service_account_json');
        if (vertexaiServiceAccountJson) vertexaiServiceAccountJson.value = settings.vertexai_service_account_json || '';
        
        const vertexaiRegion = document.getElementById('vertexai_region');
        if (vertexaiRegion) vertexaiRegion.value = settings.vertexai_region || 'us-central1';
        
        return settings;
    }

    /**
     * 제공업체별 설정 UI 표시/숨김 토글 (실리태번 방식)
     */
    toggleProviderSpecificSettings() {
        const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
        if (!chatCompletionSourceSelect) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_UI_20001', 'chat-completion-source select를 찾을 수 없음');
            }
            return;
        }
        
        const selectedProvider = chatCompletionSourceSelect.value || 'openai';
        
        // 설정 모달 내부의 모든 data-source 속성을 가진 요소 찾기
        const settingsModal = document.getElementById('settings-modal');
        if (!settingsModal) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_UI_20002', 'settings-modal을 찾을 수 없음');
            }
            return;
        }
        
        const allProviderElements = settingsModal.querySelectorAll('[data-source]');
        
        allProviderElements.forEach(element => {
            const dataSource = element.getAttribute('data-source');
            if (!dataSource) return;
            
            const validSources = dataSource.split(',').map(s => s.trim());
            const shouldShow = validSources.includes(selectedProvider);
            
            // form 또는 div 블록 전체를 표시/숨김
            if (shouldShow) {
                element.classList.add('provider-active');
                element.style.display = 'block';
                element.removeAttribute('hidden');
            } else {
                element.classList.remove('provider-active');
                element.style.display = 'none';
                element.setAttribute('hidden', '');
            }
        });
    }

    /**
     * 제공업체별 모델 옵션 업데이트
     */
    updateModelOptions() {
        const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
        if (!chatCompletionSourceSelect) return;

        const provider = chatCompletionSourceSelect.value;
        
        // 제공업체별 모델 select ID 매핑
        const providerModelMap = {
            'openai': 'model_openai_select',
            'claude': 'model_claude_select',
            'openrouter': 'model_openrouter_select',
            'ai21': 'model_ai21_select',
            'makersuite': 'model_makersuite_select',
            'vertexai': 'model_vertexai_select',
            'mistralai': 'model_mistralai_select',
            'custom': 'model_custom_select',
            'cohere': 'model_cohere_select',
            'perplexity': 'model_perplexity_select',
            'groq': 'model_groq_select',
            'electronhub': 'model_electronhub_select',
            'nanogpt': 'model_nanogpt_select',
            'deepseek': 'model_deepseek_select',
            'aimlapi': 'model_aimlapi_select',
            'xai': 'model_xai_select',
            'pollinations': 'model_pollinations_select',
            'moonshot': 'model_moonshot_select',
            'fireworks': 'model_fireworks_select',
            'cometapi': 'model_cometapi_select',
            'azure_openai': 'azure_openai_model',
            'zai': 'model_zai_select',
        };
        
        const modelSelectId = providerModelMap[provider];
        if (!modelSelectId) return;
        
        const modelSelect = document.getElementById(modelSelectId);
        if (!modelSelect) return;
        
        // 모델 목록 가져오기
        const models = getModelsForProvider(provider);
        
        // 기존 옵션 제거 (첫 번째 옵션 제외)
        const firstOption = modelSelect.querySelector('option');
        modelSelect.innerHTML = '';
        if (firstOption) {
            modelSelect.appendChild(firstOption);
        } else {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '모델을 선택하세요';
            modelSelect.appendChild(defaultOption);
        }
        
        // 새 옵션 추가
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }

    /**
     * 설정 저장
     */
    async saveSettings() {
        const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
        
        // 기존 설정 로드
        const currentSettings = await SettingsStorage.load();
        
        const provider = chatCompletionSourceSelect ? chatCompletionSourceSelect.value : 'openai';
        
        // 제공업체별 API 키 필드 ID 매핑 (실리태번 ID 형식)
        const providerKeyMap = {
            'openai': 'api_key_openai',
            'claude': 'api_key_claude',
            'openrouter': 'api_key_openrouter',
            'ai21': 'api_key_ai21',
            'makersuite': 'api_key_makersuite',
            'vertexai': 'api_key_vertexai',
            'mistralai': 'api_key_mistralai',
            'custom': 'api_key_custom',
            'cohere': 'api_key_cohere',
            'perplexity': 'api_key_perplexity',
            'groq': 'api_key_groq',
            'electronhub': 'api_key_electronhub',
            'nanogpt': 'api_key_nanogpt',
            'deepseek': 'api_key_deepseek',
            'aimlapi': 'api_key_aimlapi',
            'xai': 'api_key_xai',
            'pollinations': null, // Pollinations는 API 키 없음
            'moonshot': 'api_key_moonshot',
            'fireworks': 'api_key_fireworks',
            'cometapi': 'api_key_cometapi',
            'azure_openai': 'api_key_azure_openai',
            'zai': 'api_key_zai',
        };
        
        // 모든 제공업체의 API 키를 읽어서 저장
        const apiKeys = currentSettings.apiKeys || {};
        Object.keys(providerKeyMap).forEach(providerKey => {
            const inputId = providerKeyMap[providerKey];
            if (inputId) {
                const input = document.getElementById(inputId);
                if (input) {
                    apiKeys[providerKey] = input.value || '';
                }
            } else {
                // Pollinations는 API 키 없음
                apiKeys[providerKey] = '';
            }
        });
        
        // 모든 제공업체의 모델을 읽어서 저장
        const apiModels = currentSettings.apiModels || {};
        const providerModelMap = {
            'openai': 'model_openai_select',
            'claude': 'model_claude_select',
            'openrouter': 'model_openrouter_select',
            'ai21': 'model_ai21_select',
            'makersuite': 'model_makersuite_select',
            'vertexai': 'model_vertexai_select',
            'mistralai': 'model_mistralai_select',
            'custom': 'model_custom_select',
            'cohere': 'model_cohere_select',
            'perplexity': 'model_perplexity_select',
            'groq': 'model_groq_select',
            'electronhub': 'model_electronhub_select',
            'nanogpt': 'model_nanogpt_select',
            'deepseek': 'model_deepseek_select',
            'aimlapi': 'model_aimlapi_select',
            'xai': 'model_xai_select',
            'pollinations': 'model_pollinations_select',
            'moonshot': 'model_moonshot_select',
            'fireworks': 'model_fireworks_select',
            'cometapi': 'model_cometapi_select',
            'azure_openai': 'model_azure_openai_select',
            'zai': 'model_zai_select',
        };
        
        Object.keys(providerModelMap).forEach(providerKey => {
            const selectId = providerModelMap[providerKey];
            const select = document.getElementById(selectId);
            if (select) {
                const model = select.value || '';
                if (model) {
                    apiModels[providerKey] = model;
                }
            }
        });
        
        // Azure OpenAI 설정 저장
        const azureBaseUrl = document.getElementById('azure_base_url');
        const azureDeploymentName = document.getElementById('azure_deployment_name');
        const azureApiVersion = document.getElementById('azure_api_version');
        
        if (azureBaseUrl) currentSettings.azure_base_url = azureBaseUrl.value;
        if (azureDeploymentName) currentSettings.azure_deployment_name = azureDeploymentName.value;
        if (azureApiVersion) currentSettings.azure_api_version = azureApiVersion.value;
        
        // Custom API 설정 저장
        const customUrl = document.getElementById('custom_api_url_text');
        if (customUrl) currentSettings.custom_url = customUrl.value;
        
        const customModelId = document.getElementById('custom_model_id');
        if (customModelId) currentSettings.custom_model_id = customModelId.value;
        
        const azureModel = document.getElementById('azure_openai_model');
        if (azureModel) {
            if (!currentSettings.apiModels) currentSettings.apiModels = {};
            currentSettings.apiModels.azure_openai = azureModel.value;
        }

        // OpenAI 추가 설정 저장
        const openaiBypassStatusCheck = document.getElementById('openai_bypass_status_check');
        if (openaiBypassStatusCheck) currentSettings.openai_bypass_status_check = openaiBypassStatusCheck.checked;
        
        const openaiShowExternalModels = document.getElementById('openai_show_external_models');
        if (openaiShowExternalModels) currentSettings.openai_show_external_models = openaiShowExternalModels.checked;

        // Google Vertex AI 설정 저장
        const vertexaiAuthMode = document.getElementById('vertexai_auth_mode');
        if (vertexaiAuthMode) currentSettings.vertexai_auth_mode = vertexaiAuthMode.value || 'express';
        
        const vertexaiExpressProjectId = document.getElementById('vertexai_express_project_id');
        if (vertexaiExpressProjectId) currentSettings.vertexai_express_project_id = vertexaiExpressProjectId.value || '';
        
        const vertexaiServiceAccountJson = document.getElementById('vertexai_service_account_json');
        if (vertexaiServiceAccountJson) currentSettings.vertexai_service_account_json = vertexaiServiceAccountJson.value || '';
        
        const vertexaiRegion = document.getElementById('vertexai_region');
        if (vertexaiRegion) currentSettings.vertexai_region = vertexaiRegion.value || 'us-central1';
        
        const settings = {
            ...currentSettings,
            apiProvider: provider,
            apiKeys: apiKeys,
            apiModels: apiModels,
        };
        
        // IndexedDB에 설정 저장
        await SettingsStorage.save(settings);
    }

    /**
     * Connect 버튼 클릭 핸들러
     * API 키 저장 및 설정 저장, 연결 상태 확인
     */
    async onConnectButtonClick() {
        try {
            // 설정 저장
            await this.saveSettings();

            // 현재 선택된 API provider 가져오기
            const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
            if (!chatCompletionSourceSelect) {
                this.showApiStatus('API provider를 선택해주세요.', 'error');
                return;
            }

            const apiProvider = chatCompletionSourceSelect.value;
            if (!apiProvider) {
                this.showApiStatus('API provider를 선택해주세요.', 'error');
                return;
            }

            // API 키 확인 (Vertex AI Full 모드는 Service Account JSON 사용)
            let apiKey = null;
            if (apiProvider === 'vertexai') {
                const vertexaiAuthMode = document.getElementById('vertexai_auth_mode');
                if (vertexaiAuthMode && vertexaiAuthMode.value === 'full') {
                    // Full 모드: Service Account JSON 확인
                    const serviceAccountInput = document.getElementById('vertexai_service_account_json');
                    if (!serviceAccountInput || !serviceAccountInput.value.trim()) {
                        this.showApiStatus('Service Account JSON을 입력해주세요.', 'error');
                        return;
                    }
                    // Full 모드: 설정 저장 (브라우저에서도 Web Crypto API를 통해 테스트 가능)
                    await this.saveSettings();
                    this.showApiStatus('Service Account JSON이 저장되었습니다.', 'success');
                    return;
                } else {
                    // Express 모드: API 키 확인
                    apiKey = this.getApiKeyForProvider(apiProvider);
                    if (!apiKey) {
                        this.showApiStatus('API 키를 입력해주세요.', 'error');
                        return;
                    }
                }
            } else {
                apiKey = this.getApiKeyForProvider(apiProvider);
                if (!apiKey && apiProvider !== 'pollinations' && apiProvider !== 'custom') {
                    this.showApiStatus('API 키를 입력해주세요.', 'error');
                    return;
                }
            }

            // 연결 상태 확인
            this.showApiStatus('연결 중...', 'hint');
            
            // 일부 API는 상태 확인 없이 바로 저장만 함 (SillyTavern 참고)
            const noValidateSources = ['claude', 'ai21', 'vertexai', 'perplexity', 'zai'];
            if (noValidateSources.includes(apiProvider)) {
                this.showApiStatus('API 키가 저장되었습니다. "Test Message"를 눌러 확인하세요.', 'success');
                return;
            }

            // 상태 확인 성공 (실제 구현은 나중에 API 서버가 필요할 때)
            this.showApiStatus('API 키가 저장되었습니다. "Test Message"를 눌러 확인하세요.', 'success');
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_UI_13004', 'API 연결 오류', error);
            }
            this.showApiStatus('연결 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }

    /**
     * Test Message 버튼 클릭 핸들러
     * 실제 API에 테스트 메시지 전송
     */
    async onTestMessageClick() {
        try {
            // 현재 선택된 API provider 가져오기
            const chatCompletionSourceSelect = document.getElementById('chat-completion-source');
            if (!chatCompletionSourceSelect || !chatCompletionSourceSelect.value) {
                this.showApiStatus('API provider를 선택해주세요.', 'error');
                return;
            }

            const apiProvider = chatCompletionSourceSelect.value;

            // API 키 확인 (Vertex AI Full 모드는 Service Account JSON 사용)
            let apiKey = null;
            let vertexaiServiceAccountJson = null;
            
            if (apiProvider === 'vertexai') {
                const vertexaiAuthMode = document.getElementById('vertexai_auth_mode');
                if (vertexaiAuthMode && vertexaiAuthMode.value === 'full') {
                    // Full 모드: Service Account JSON 확인
                    const serviceAccountInput = document.getElementById('vertexai_service_account_json');
                    if (!serviceAccountInput || !serviceAccountInput.value.trim()) {
                        this.showApiStatus('Service Account JSON을 입력해주세요.', 'error');
                        return;
                    }
                    vertexaiServiceAccountJson = serviceAccountInput.value.trim();
                    // Full 모드에서는 API 키가 필요 없음
                    apiKey = null;
                } else {
                    // Express 모드: API 키 확인
                    apiKey = this.getApiKeyForProvider(apiProvider);
                    if (!apiKey) {
                        this.showApiStatus('API 키를 입력해주세요.', 'error');
                        return;
                    }
                }
            } else {
                apiKey = this.getApiKeyForProvider(apiProvider);
                if (!apiKey && apiProvider !== 'pollinations' && apiProvider !== 'custom') {
                    this.showApiStatus('API 키를 입력해주세요.', 'error');
                    return;
                }
            }

            // 모델 확인 (DOM에서 먼저 확인, 없으면 설정에서 로드)
            let model = this.getModelForProvider(apiProvider);
            if (!model) {
                // DOM에서 가져오지 못한 경우 설정에서 직접 로드
                const settings = await SettingsStorage.load();
                const apiModels = settings.apiModels || {};
                model = apiModels[apiProvider] || '';
                
                if (!model) {
                    this.showApiStatus('모델을 선택해주세요.', 'error');
                    return;
                }
            }

            // 테스트 메시지 전송
            this.showApiStatus('테스트 메시지 전송 중...', 'hint');

            // callAI - 전역 스코프에서 사용
            
            // 설정에서 추가 옵션 가져오기
            const settings = await SettingsStorage.load();
            
            // Vertex AI 관련 설정 가져오기
            let vertexaiAuthMode = 'express';
            let vertexaiRegion = 'us-central1';
            let vertexaiProjectId = null;
            
            if (apiProvider === 'vertexai') {
                const vertexaiAuthModeSelect = document.getElementById('vertexai_auth_mode');
                const vertexaiRegionInput = document.getElementById('vertexai_region');
                const vertexaiProjectIdInput = document.getElementById('vertexai_express_project_id');
                
                if (vertexaiAuthModeSelect) {
                    vertexaiAuthMode = vertexaiAuthModeSelect.value || 'express';
                }
                if (vertexaiRegionInput) {
                    vertexaiRegion = vertexaiRegionInput.value || settings.vertexai_region || 'us-central1';
                }
                if (vertexaiProjectIdInput) {
                    vertexaiProjectId = vertexaiProjectIdInput.value || settings.vertexai_express_project_id || null;
                }
                
                // Full 모드일 때는 위에서 이미 Service Account JSON을 가져왔으므로 재사용
                if (vertexaiAuthMode === 'full') {
                    // vertexaiServiceAccountJson은 이미 위에서 설정됨
                }
            }
            
            // 테스트 메시지는 연결 상태만 확인하므로 에러가 없으면 성공으로 처리
            await callAI({
                apiSource: apiProvider,
                apiKey: apiKey || '',
                model: model,
                messages: [{ role: 'user', content: 'Hi' }],
                temperature: 1.0,
                maxTokens: 50,
                stream: false,
                azureBaseUrl: settings.azure_base_url,
                azureDeploymentName: settings.azure_deployment_name,
                azureApiVersion: settings.azure_api_version,
                customUrl: settings.custom_url,
                proxyUrl: null, // 프록시 미사용
                vertexaiAuthMode: vertexaiAuthMode,
                vertexaiRegion: vertexaiRegion,
                vertexaiProjectId: vertexaiProjectId,
                vertexaiServiceAccountJson: vertexaiServiceAccountJson,
            });

            // 에러가 발생하지 않으면 연결 성공 (응답 내용은 중요하지 않음)
            this.showApiStatus('API 연결 성공!', 'success');
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_UI_13005', 'API 테스트 메시지 오류', error);
            }
            this.showApiStatus('API 연결 실패: ' + (error.message || '알 수 없는 오류'), 'error');
        }
    }

    /**
     * 현재 선택된 provider의 API 키 가져오기
     */
    getApiKeyForProvider(provider) {
        const providerKeyMap = {
            'openai': 'api_key_openai',
            'claude': 'api_key_claude',
            'openrouter': 'api_key_openrouter',
            'ai21': 'api_key_ai21',
            'makersuite': 'api_key_makersuite',
            'vertexai': 'api_key_vertexai',
            'mistralai': 'api_key_mistralai',
            'custom': 'api_key_custom',
            'cohere': 'api_key_cohere',
            'perplexity': 'api_key_perplexity',
            'groq': 'api_key_groq',
            'electronhub': 'api_key_electronhub',
            'nanogpt': 'api_key_nanogpt',
            'deepseek': 'api_key_deepseek',
            'aimlapi': 'api_key_aimlapi',
            'xai': 'api_key_xai',
            'moonshot': 'api_key_moonshot',
            'fireworks': 'api_key_fireworks',
            'cometapi': 'api_key_cometapi',
            'azure_openai': 'api_key_azure_openai',
            'zai': 'api_key_zai',
        };

        const inputId = providerKeyMap[provider];
        if (!inputId) return null;

        const input = document.getElementById(inputId);
        return input ? input.value.trim() : null;
    }

    /**
     * 현재 선택된 provider의 모델 가져오기
     */
    getModelForProvider(provider) {
        const providerModelMap = {
            'openai': 'model_openai_select',
            'claude': 'model_claude_select',
            'openrouter': 'model_openrouter_select',
            'ai21': 'model_ai21_select',
            'makersuite': 'model_makersuite_select',
            'vertexai': 'model_vertexai_select',
            'mistralai': 'model_mistralai_select',
            'custom': 'model_custom_select',
            'cohere': 'model_cohere_select',
            'perplexity': 'model_perplexity_select',
            'groq': 'model_groq_select',
            'electronhub': 'model_electronhub_select',
            'nanogpt': 'model_nanogpt_select',
            'deepseek': 'model_deepseek_select',
            'aimlapi': 'model_aimlapi_select',
            'xai': 'model_xai_select',
            'pollinations': 'model_pollinations_select',
            'moonshot': 'model_moonshot_select',
            'fireworks': 'model_fireworks_select',
            'cometapi': 'model_cometapi_select',
            'azure_openai': 'azure_openai_model',
            'zai': 'model_zai_select',
        };

        const selectId = providerModelMap[provider];
        if (!selectId) return null;

        const select = document.getElementById(selectId);
        return select ? select.value.trim() : null;
    }

    /**
     * API 상태 메시지 표시
     */
    showApiStatus(message, type = 'hint') {
        const statusDiv = document.getElementById('api_status_message');
        const statusText = document.getElementById('api_status_text');
        
        if (!statusDiv || !statusText) return;

        statusDiv.style.display = 'block';
        statusText.textContent = message;

        // 기존 클래스 제거
        statusDiv.classList.remove('hint', 'success', 'error');
        
        // 타입에 따른 클래스 추가
        if (type === 'success') {
            statusDiv.classList.add('success');
        } else if (type === 'error') {
            statusDiv.classList.add('error');
        } else {
            statusDiv.classList.add('hint');
        }
    }

    /**
     * PresetManager 초기화
     */
    async initPresetManager() {
        const presetSelect = document.getElementById('settings_preset_openai');
        if (!presetSelect) return;

        // PresetManager 등록
        const manager = registerPresetManager(presetSelect, 'openai');

        // 이벤트 리스너 설정
        this.setupPresetEventListeners(manager);
    }

    /**
     * Preset 이벤트 리스너 설정
     */
    setupPresetEventListeners(manager) {
        const presetSelect = document.getElementById('settings_preset_openai');

        // Update 버튼
        const updateBtn = document.getElementById('update_oai_preset');
        if (updateBtn) {
            updateBtn.addEventListener('click', async () => {
                await manager.updatePreset();
            });
        }

        // Save as 버튼
        const saveAsBtn = document.getElementById('new_oai_preset');
        if (saveAsBtn) {
            saveAsBtn.addEventListener('click', async () => {
                await manager.savePresetAs();
            });
        }

        // Rename 버튼
        const renameBtn = document.querySelector('[data-preset-manager-rename="openai"]');
        if (renameBtn) {
            renameBtn.addEventListener('click', async () => {
                await manager.renamePreset();
            });
        }

        // Import 버튼
        const importBtn = document.getElementById('import_oai_preset');
        const importFile = document.getElementById('openai_preset_import_file');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => {
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
        const exportBtn = document.getElementById('export_oai_preset');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                manager.exportPreset();
            });
        }

        // Delete 버튼
        const deleteBtn = document.getElementById('delete_oai_preset');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                await manager.deletePreset();
            });
        }

        // Preset 선택 변경
        if (presetSelect) {
            presetSelect.addEventListener('change', async () => {
                await manager.selectPreset(manager.getSelectedPresetName());
            });
        }
    }
}
