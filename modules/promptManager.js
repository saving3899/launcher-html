/**
 * PromptManager 클래스
 * 프롬프트 관리 메인 클래스
 * 실리태번의 PromptManager.js 구조를 완전히 따름
 */


// INJECTION_POSITION 상수
const INJECTION_POSITION = {
    RELATIVE: 0,
    ABSOLUTE: 1,
};

// DEFAULT 값
const DEFAULT_DEPTH = 4;
const DEFAULT_ORDER = 100;

/**
 * 기본 프롬프트 정의 (실리태번과 동일)
 */
const chatCompletionDefaultPrompts = {
    prompts: [
        {
            name: 'Main Prompt',
            system_prompt: true,
            role: 'system',
            content: 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.',
            identifier: 'main',
        },
        {
            name: 'Auxiliary Prompt',
            system_prompt: true,
            role: 'system',
            content: '',
            identifier: 'nsfw',
        },
        {
            identifier: 'dialogueExamples',
            name: 'Chat Examples',
            system_prompt: true,
            marker: true,
        },
        {
            name: 'Post-History Instructions',
            system_prompt: true,
            role: 'system',
            content: '',
            identifier: 'jailbreak',
        },
        {
            identifier: 'chatHistory',
            name: 'Chat History',
            system_prompt: true,
            marker: true,
        },
        {
            identifier: 'worldInfoAfter',
            name: 'World Info (after)',
            system_prompt: true,
            marker: true,
        },
        {
            identifier: 'worldInfoBefore',
            name: 'World Info (before)',
            system_prompt: true,
            marker: true,
        },
        {
            identifier: 'enhanceDefinitions',
            role: 'system',
            name: 'Enhance Definitions',
            content: 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.',
            system_prompt: true,
            marker: false,
        },
        {
            identifier: 'charDescription',
            name: 'Char Description',
            system_prompt: true,
            marker: true,
        },
        {
            identifier: 'charPersonality',
            name: 'Char Personality',
            system_prompt: true,
            marker: true,
        },
        {
            identifier: 'scenario',
            name: 'Scenario',
            system_prompt: true,
            marker: true,
        },
        {
            identifier: 'personaDescription',
            name: 'Persona Description',
            system_prompt: true,
            marker: true,
        },
    ],
};

/**
 * 기본 프롬프트 순서 (실리태번과 동일)
 */
const promptManagerDefaultPromptOrder = [
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
    { identifier: 'jailbreak', enabled: true },
];

/**
 * UUID v4 생성 (실리태번의 uuidv4 함수와 동일)
 * @returns {string}
 */
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * PromptManager 클래스
 */
// PromptManager 클래스에서 사용할 PromptCollection import
// (이미 상단에 있음)

class PromptManager {
    /**
     * 프롬프트 소스 이름
     */
    get promptSources() {
        return {
            charDescription: 'Character Description',
            charPersonality: 'Character Personality',
            scenario: 'Character Scenario',
            personaDescription: 'Persona Description',
            worldInfoBefore: 'World Info (↑Char)',
            worldInfoAfter: 'World Info (↓Char)',
        };
    }

    /**
     * 생성자
     */
    constructor() {
        // 시스템 프롬프트 식별자
        this.systemPrompts = [
            'main',
            'nsfw',
            'jailbreak',
            'enhanceDefinitions',
        ];

        // 오버라이드 가능한 프롬프트
        this.overridablePrompts = [
            'main',
            'jailbreak',
        ];

        // 오버라이드된 프롬프트
        this.overriddenPrompts = [];

        // 현재 선택된 프롬프트 ID (append_prompt select와 동기화)
        this.selectedPromptId = '';

        // 설정
        this.configuration = {
            version: 1,
            prefix: 'completion_',
            containerIdentifier: 'completion_prompt_manager',
            listIdentifier: 'completion_prompt_manager_list',
            toggleDisabled: [],
            promptOrder: {
                strategy: 'global', // 'global' 또는 'character'
                dummyId: 100000, // 전역 설정의 더미 ID
            },
            sortableDelay: 30,
            warningTokenThreshold: 1500,
            dangerTokenThreshold: 500,
            defaultPrompts: {
                main: 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.',
                nsfw: '',
                jailbreak: '',
                enhanceDefinitions: 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.',
            },
        };

        // 서비스 설정 (프롬프트 배열 포함)
        this.serviceSettings = null;

        // DOM 요소
        this.containerElement = null;
        this.listElement = null;

        // 현재 선택된 캐릭터
        this.activeCharacter = null;

        // 메시지 컬렉션 (나중에 구현)
        this.messages = null;

        // 토큰 핸들러 (실리태번과 동일)
        this.tokenHandler = null;
        
        // 토큰 카운팅 함수 (tiktoken 사용, 한글/영어 정확히 지원)
        this.countTokensAsync = async (messages, full = false) => {
            try {
                // tokenCounter 모듈에서 정확한 토큰 카운팅
                // countTokens, getCurrentModel - 전역 스코프에서 사용
                const model = getCurrentModel(this);
                const result = await countTokens(messages, model, full);
                return result;
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_TOKEN_15001', '토큰 카운팅 오류, 추정 방식 사용', error);
                }
                // 폴백: 개선된 추정 방식
                if (Array.isArray(messages)) {
                    return messages.reduce((total, msg) => {
                        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || {});
                        // 한글/영어 구분 추정
                        let koreanChars = 0;
                        let englishChars = 0;
                        for (let i = 0; i < content.length; i++) {
                            const code = content.charCodeAt(i);
                            if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)) {
                                koreanChars++;
                            } else {
                                englishChars++;
                            }
                        }
                        return total + Math.ceil(koreanChars * 2.5) + Math.ceil(englishChars / 4);
                    }, 0);
                }
                const content = typeof messages.content === 'string' ? messages.content : JSON.stringify(messages.content || {});
                return Math.ceil(content.length / 4);
            }
        };

        // 토큰 사용량
        this.tokenUsage = 0;

        // 에러 상태
        this.error = null;

        // 콜백 함수들 (외부에서 설정)
        this.tryGenerate = async () => { };
        this.saveServiceSettings = () => { return Promise.resolve(); };

        // 이벤트 핸들러들 (init에서 설정)
        this.handleToggle = () => { };
        this.handleInspect = () => { };
        this.handleEdit = () => { };
        this.handleDetach = () => { };
        this.handleSavePrompt = () => { };
        this.handleResetPrompt = () => { };
        this.handleNewPrompt = () => { };
        this.handleDeletePrompt = () => { };
        this.handleAppendPrompt = () => { };
        this.handleImport = async () => {
            const confirmed = await showConfirmModal('기존 프롬프트와 동일한 ID가 있으면 덮어씌워집니다. 계속하시겠습니까?', '프롬프트 가져오기');
            if (!confirmed) return;

            const fileOpener = document.createElement('input');
            fileOpener.type = 'file';
            fileOpener.accept = '.json';

            fileOpener.addEventListener('change', async (event) => {
                if (!(event.target instanceof HTMLInputElement)) return;
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();

                reader.onload = async (event) => {
                    try {
                        const fileContent = event.target.result;
                        const data = JSON.parse(fileContent.toString());
                        await this.import(data);
                    } catch (err) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_FILE_6003', '프롬프트 불러오기 오류', err);
                        } else if (typeof showToast === 'function') {
                            showToast('프롬프트 가져오기 중 오류가 발생했습니다. 콘솔을 확인하세요.', 'error');
                        }
                    }
                };

                reader.onerror = () => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_FILE_6004', '프롬프트 파일 읽기 실패');
                    } else if (typeof showToast === 'function') {
                        showToast('파일 읽기 중 오류가 발생했습니다.', 'error');
                    }
                };

                reader.readAsText(file);
            });

            fileOpener.click();
        };
        this.handleFullExport = () => { };
        this.handleCharacterExport = () => { };
        this.handleCharacterReset = () => { };

        // 렌더링 디바운스 (나중에 구현)
        // this.renderDebounced = debounce(this.render.bind(this), debounce_timeout.relaxed);
    }

    /**
     * 초기화
     * @param {Object} moduleConfiguration - 모듈 설정
     * @param {Object} serviceSettings - 서비스 설정 (프롬프트 배열 포함)
     */
    async init(moduleConfiguration, serviceSettings) {
        // 설정 병합
        this.configuration = Object.assign(this.configuration, moduleConfiguration);
        
        // 서비스 설정 저장
        this.serviceSettings = serviceSettings;

        // DOM 요소 가져오기
        this.containerElement = document.getElementById(this.configuration.containerIdentifier);
        
        // listElement는 renderPromptManager()에서 생성되므로 여기서는 null
        // init 시점에는 아직 ul 요소가 생성되지 않음
        this.listElement = null;

        // 전역 전략이면 더미 캐릭터 설정
        if ('global' === this.configuration.promptOrder.strategy) {
            this.activeCharacter = { id: this.configuration.promptOrder.dummyId };
        }

        // 설정 정리
        this.sanitizeServiceSettings();

        // 토큰 핸들러 초기화 (실리태번과 동일)
        // TokenHandler - 전역 스코프에서 사용
        this.tokenHandler = new TokenHandler(this.countTokensAsync.bind(this));

        // 이벤트 핸들러 설정 (기본 구현)
        this.setupEventHandlers();

        this.log('Initialized');
    }

    /**
     * 이벤트 핸들러 설정 (기본 구현)
     */
    setupEventHandlers() {
        // Toggle 핸들러
        this.handleToggle = (event) => {
            const promptID = event.target.closest(`.${this.configuration.prefix}prompt_manager_prompt`)?.dataset.pmIdentifier;
            if (!promptID) return;

            // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 사용
            const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
            const promptOrderEntry = this.getPromptOrderEntry(dummyCharacter, promptID);
            if (promptOrderEntry) {
                promptOrderEntry.enabled = !promptOrderEntry.enabled;
                this.saveServiceSettings();
                this.render(); // UI 업데이트
            }
        };

        // Character Reset 핸들러
        // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 리셋
        this.handleCharacterReset = async () => {
            const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
            
            const confirmed = await showConfirmModal('This will reset the prompt order. You will not lose any prompts.', 'Reset Prompt Order');
            if (!confirmed) return;
            
            this.removePromptOrderForCharacter(dummyCharacter);
            this.addPromptOrderForCharacter(dummyCharacter, promptManagerDefaultPromptOrder);
            
            this.render();
            this.saveServiceSettings();
        };

        // Edit 핸들러
        this.handleEdit = (event) => {
            const promptID = event.target.closest(`.${this.configuration.prefix}prompt_manager_prompt`)?.dataset.pmIdentifier;
            if (!promptID) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20001', 'handleEdit: promptID를 찾을 수 없음');
                }
                return;
            }
            
            const prompt = this.getPromptById(promptID);
            if (!prompt) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20002', `handleEdit: ID에 해당하는 프롬프트를 찾을 수 없음: ${promptID}`);
                }
                return;
            }

            // 선택된 프롬프트 ID 저장 (append_prompt select와 동기화)
            this.selectedPromptId = promptID;
            
            // append_prompt select 업데이트
            const appendPromptSelect = document.getElementById(`${this.configuration.prefix}prompt_manager_footer_append_prompt`);
            if (appendPromptSelect) {
                appendPromptSelect.value = promptID;
            }

            // 모달이 이미 열려있으면 내용만 업데이트, 아니면 새로 열기
            const prefix = this.configuration.prefix;
            const popup = document.getElementById(`${prefix}prompt_manager_popup`);
            const isPopupOpen = popup && popup.style.display !== 'none' && !popup.classList.contains('hidden');
            
            // 모달이 닫혀있으면 먼저 열기 (clearEditForm는 showPopup 내부에서 처리됨)
            if (!isPopupOpen) {
                this.clearEditForm();
                this.clearInspectForm();
                this.loadPromptIntoEditForm(prompt);
                this.showPopup();
            } else {
                // 모달이 이미 열려있으면 내용만 업데이트
                // clearEditForm을 호출하지 않음 (현재 입력 중인 내용을 보존하기 위해)
                // 대신 바로 새로운 프롬프트 데이터 로드
                this.clearInspectForm();
                
                // edit 영역이 확실히 표시되도록
                const editArea = document.getElementById(`${prefix}prompt_manager_popup_edit`);
                if (editArea) {
                    editArea.style.display = 'block';
                }
                const inspectArea = document.getElementById(`${prefix}prompt_manager_popup_inspect`);
                if (inspectArea) {
                    inspectArea.style.display = 'none';
                }
                
                // 프롬프트 데이터 로드 (약간의 지연 후 실행하여 DOM이 준비되도록)
                setTimeout(() => {
                    this.loadPromptIntoEditForm(prompt);
                    
                    // Select2 재초기화
                    if (typeof $ !== 'undefined' && $.fn.select2) {
                        const triggerSelect = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
                        if (triggerSelect) {
                            if ($(triggerSelect).hasClass('select2-hidden-accessible')) {
                                $(triggerSelect).select2('destroy');
                            }
                            $(triggerSelect).select2({
                                placeholder: 'All types (default)',
                                width: '100%',
                                closeOnSelect: false,
                            });
                        }
                    }
                }, 10);
            }
        };

        // Inspect 핸들러
        this.handleInspect = (event) => {
            this.clearEditForm();
            this.clearInspectForm();

            const promptID = event.target.closest(`.${this.configuration.prefix}prompt_manager_prompt`)?.dataset.pmIdentifier;
            if (!promptID) return;

            // TODO: messages.hasItemWithIdentifier 구현 필요
            // 현재는 inspect 기능을 일시적으로 비활성화
            // if (this.messages?.hasItemWithIdentifier?.(promptID)) {
            //     const messages = this.messages.getItemByIdentifier(promptID);
            //     this.loadMessagesIntoInspectForm(messages);
            //     this.showPopup('inspect');
            // }
        };

        // New Prompt 핸들러
        this.handleNewPrompt = () => {
            const prompt = {
                identifier: this.getUuidv4(),
                name: '',
                role: 'system',
                content: '',
            };

            this.loadPromptIntoEditForm(prompt);
            this.showPopup();
        };

        // Delete Prompt 핸들러
        this.handleDeletePrompt = async () => {
            const appendPromptSelect = document.getElementById(`${this.configuration.prefix}prompt_manager_footer_append_prompt`);
            if (!appendPromptSelect) return;
            
            const promptID = appendPromptSelect.value;
            if (!promptID) return;

            const confirmed = await showConfirmModal('Are you sure you want to delete this prompt?', 'Delete Prompt', { confirmType: 'danger' });
            if (!confirmed) return;

            const prompt = this.getPromptById(promptID);
            if (!prompt || !this.isPromptDeletionAllowed(prompt)) {
                return;
            }

            const promptIndex = this.getPromptIndexById(promptID);
            if (promptIndex >= 0) {
                this.serviceSettings.prompts.splice(promptIndex, 1);
                this.log('Deleted prompt: ' + prompt.identifier);
                
                // prompt_order에서도 제거 (실리태번과 동일)
                if ('global' === this.configuration.promptOrder.strategy) {
                    const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
                    const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);
                    const orderIndex = promptOrder.findIndex(entry => entry.identifier === promptID);
                    if (orderIndex >= 0) {
                        promptOrder.splice(orderIndex, 1);
                        this.addPromptOrderForCharacter(dummyCharacter, promptOrder);
                        this.log(`Removed prompt ${promptID} from prompt_order`);
                    }
                } else if (this.activeCharacter) {
                    // character 전략인 경우
                    const promptOrder = this.getPromptOrderForCharacter(this.activeCharacter);
                    const orderIndex = promptOrder.findIndex(entry => entry.identifier === promptID);
                    if (orderIndex >= 0) {
                        promptOrder.splice(orderIndex, 1);
                        this.addPromptOrderForCharacter(this.activeCharacter, promptOrder);
                        this.log(`Removed prompt ${promptID} from prompt_order`);
                    }
                }
                
                this.hidePopup();
                this.clearEditForm();
                await this.render();
                
                // 삭제 후 append_prompt select 값 초기화
                const updatedAppendPromptSelect = document.getElementById(`${this.configuration.prefix}prompt_manager_footer_append_prompt`);
                if (updatedAppendPromptSelect) {
                    updatedAppendPromptSelect.value = '';
                }
                
                // selectedPromptId도 초기화
                this.selectedPromptId = '';
                
                await this.saveServiceSettings();
            }
        };

        // Append Prompt 핸들러
        this.handleAppendPrompt = () => {
            if (!this.activeCharacter) return;
            
            const appendPromptSelect = document.getElementById(`${this.configuration.prefix}prompt_manager_footer_append_prompt`);
            if (!appendPromptSelect) return;
            
            const promptID = appendPromptSelect.value;
            if (!promptID) return;

            const prompt = this.getPromptById(promptID);
            if (prompt) {
                this.appendPrompt(prompt, this.activeCharacter);
                this.render();
                this.saveServiceSettings();
            }
        };

        // Save Prompt 핸들러
        this.handleSavePrompt = async (event) => {
            const promptId = event.target?.dataset?.pmPrompt;
            if (!promptId) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20003', 'handleSavePrompt: promptId가 없음');
                }
                return;
            }

            const prompt = this.getPromptById(promptId);
            
            if (!prompt) {
                // 새 프롬프트 생성
                const newPrompt = {
                    identifier: promptId || this.getUuidv4(),
                    name: '',
                    role: 'system',
                    content: '',
                    injection_position: INJECTION_POSITION.RELATIVE,
                    injection_depth: DEFAULT_DEPTH,
                    injection_order: DEFAULT_ORDER,
                    injection_trigger: [],
                    system_prompt: false,
                    marker: false,
                    forbid_overrides: false,
                };
                this.updatePromptWithPromptEditForm(newPrompt);
                this.addPrompt(newPrompt);
            } else {
                // 기존 프롬프트 업데이트
                this.updatePromptWithPromptEditForm(prompt);
            }

            this.log('Saved prompt: ' + promptId);

            this.hidePopup();
            this.clearEditForm();
            await this.render();
            await this.saveServiceSettings();
        };

        // Reset Prompt 핸들러
        this.handleResetPrompt = (event) => {
            const promptId = event.target?.dataset?.pmPrompt;
            if (!promptId) return;

            const prompt = this.getPromptById(promptId);
            if (!prompt) return;

            // TODO: defaultPrompts 설정 필요
            // 현재는 기본값만 설정
            switch (promptId) {
                case 'main':
                    prompt.name = 'Main Prompt';
                    prompt.content = 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.';
                    prompt.forbid_overrides = false;
                    break;
                case 'nsfw':
                    prompt.name = 'Auxiliary Prompt';
                    prompt.content = '';
                    break;
                case 'jailbreak':
                    prompt.name = 'Post-History Instructions';
                    prompt.content = '';
                    prompt.forbid_overrides = false;
                    break;
            }

            // 폼 필드 업데이트
            const nameField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_name`);
            const roleField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_role`);
            const promptField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_prompt`);
            const injectionPositionField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_injection_position`);
            const injectionDepthField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_injection_depth`);
            const injectionOrderField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_injection_order`);
            const injectionTriggerField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_injection_trigger`);
            const depthBlock = document.getElementById(`${this.configuration.prefix}prompt_manager_depth_block`);
            const orderBlock = document.getElementById(`${this.configuration.prefix}prompt_manager_order_block`);
            const forbidOverridesField = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_forbid_overrides`);

            if (nameField) nameField.value = prompt.name || '';
            if (roleField) roleField.value = prompt.role || 'system';
            if (promptField) promptField.value = prompt.content || '';
            if (injectionPositionField) injectionPositionField.value = (prompt.injection_position ?? 0).toString();
            if (injectionDepthField) injectionDepthField.value = (prompt.injection_depth ?? DEFAULT_DEPTH).toString();
            if (injectionOrderField) injectionOrderField.value = (prompt.injection_order ?? DEFAULT_ORDER).toString();
            
            if (injectionTriggerField) {
                Array.from(injectionTriggerField.options).forEach(option => {
                    option.selected = Array.isArray(prompt.injection_trigger) && prompt.injection_trigger.includes(option.value);
                });
            }

            if (depthBlock) depthBlock.style.display = prompt.injection_position === INJECTION_POSITION.ABSOLUTE ? 'block' : 'none';
            if (orderBlock) orderBlock.style.display = prompt.injection_position === INJECTION_POSITION.ABSOLUTE ? 'block' : 'none';
            if (forbidOverridesField) forbidOverridesField.checked = prompt.forbid_overrides ?? false;
        };

        // Import 핸들러
        this.handleImport = async () => {
            const confirmed = await showConfirmModal('Existing prompts with the same ID will be overridden. Do you want to proceed?', 'Import Prompts');
            if (!confirmed) return;

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';

            fileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        await this.import(data);
                    } catch (err) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_FILE_6003', '프롬프트 불러오기 오류', err);
                        } else if (typeof showToast === 'function') {
                            showToast('Failed to import prompts. Check console for details.', 'error');
                        }
                    }
                };
                reader.readAsText(file);
            });

            fileInput.click();
        };

        // Full Export 핸들러
        this.handleFullExport = async () => {
            const prompts = this.serviceSettings.prompts.reduce((userPrompts, prompt) => {
                if (false === prompt.system_prompt && !prompt.marker) {
                    userPrompts.push(prompt);
                }
                return userPrompts;
            }, []);

            let promptOrder = [];
            if ('global' === this.configuration.promptOrder.strategy) {
                promptOrder = this.getPromptOrderForCharacter({ id: this.configuration.promptOrder.dummyId });
            } else if ('character' === this.configuration.promptOrder.strategy) {
                promptOrder = [];
            } else {
                throw new Error('Prompt order strategy not supported.');
            }

            const exportData = {
                prompts: prompts,
                prompt_order: promptOrder,
            };

            await this.export(exportData, 'full', 'st-prompts');
        };

        // Character Export 핸들러
        this.handleCharacterExport = async () => {
            if (!this.activeCharacter) return;

            const characterPrompts = this.getPromptsForCharacter(this.activeCharacter).reduce((userPrompts, prompt) => {
                if (false === prompt.system_prompt && !prompt.marker) {
                    userPrompts.push(prompt);
                }
                return userPrompts;
            }, []);

            const characterList = this.getPromptOrderForCharacter(this.activeCharacter);

            const exportData = {
                prompts: characterPrompts,
                prompt_order: characterList,
            };

            const charName = this.activeCharacter?.name || this.activeCharacter?.data?.name || 'character';
            const name = charName + '-prompts';
            await this.export(exportData, 'character', name);
        };
    }

    /**
     * 설정 정리 (sanitizeServiceSettings)
     * 실리태번과 동일한 로직
     */
    sanitizeServiceSettings() {
        // 실리태번과 동일하게 빈 배열로 초기화
        this.serviceSettings.prompts = this.serviceSettings.prompts ?? [];
        this.serviceSettings.prompt_order = this.serviceSettings.prompt_order ?? [];

        // global 전략이고 더미 캐릭터의 prompt_order가 비어있으면 기본 순서 추가
        if ('global' === this.configuration.promptOrder.strategy) {
            const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
            const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);
            
            if (promptOrder.length === 0) {
                this.addPromptOrderForCharacter(dummyCharacter, promptManagerDefaultPromptOrder);
            }
        }

        // 프롬프트가 없으면 기본 프롬프트 설정
        if (this.serviceSettings.prompts.length === 0) {
            this.setPrompts(chatCompletionDefaultPrompts.prompts);
        } else {
            // 누락된 프롬프트 추가
            this.checkForMissingPrompts(this.serviceSettings.prompts);
        }

        // identifier가 없는 프롬프트에 UUID 할당 및 role 기본값 설정 (실리태번과 동일)
        this.serviceSettings.prompts.forEach(prompt => {
            if (prompt) {
                if (!prompt.identifier) {
                    prompt.identifier = this.getUuidv4();
                }
                // role이 없으면 기본값 'system' 설정
                if (!prompt.role) {
                    prompt.role = 'system';
                }
            }
        });

        // 활성 캐릭터의 prompt_order 참조 정리
        if (this.activeCharacter) {
            const promptReferences = this.getPromptOrderForCharacter(this.activeCharacter);
            for (let i = promptReferences.length - 1; i >= 0; i--) {
                const reference = promptReferences[i];
                if (reference && -1 === this.serviceSettings.prompts.findIndex(prompt => prompt.identifier === reference.identifier)) {
                    promptReferences.splice(i, 1);
                    this.log('Removed unused reference: ' + reference.identifier);
                }
            }
        }

        // prompt_order에 없는 사용자 추가 프롬프트 자동 추가 (실리태번과 동일: 프롬프트 추가 시 prompt_order에도 자동 추가되어야 함)
        if ('global' === this.configuration.promptOrder.strategy) {
            const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
            const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);
            const existingIdentifiers = new Set(promptOrder.map(e => e.identifier));
            
            // 기본 프롬프트 identifier 목록
            const defaultPromptIdentifiers = ['main', 'nsfw', 'jailbreak', 'worldInfoBefore', 'worldInfoAfter', 
                                              'charDescription', 'charPersonality', 'scenario', 'personaDescription',
                                              'enhanceDefinitions', 'dialogueExamples', 'chatHistory', 'impersonate',
                                              'quietPrompt', 'groupNudge', 'bias'];
            
            // prompt_order에 없는 사용자 추가 프롬프트 찾기
            const missingPrompts = this.serviceSettings.prompts.filter(prompt => {
                // 이미 prompt_order에 있는 프롬프트는 제외
                if (existingIdentifiers.has(prompt.identifier)) {
                    return false;
                }
                // system_prompt나 marker 프롬프트는 제외 (이미 prompt_order에 포함되어 있어야 함)
                if (prompt.system_prompt || prompt.marker) {
                    return false;
                }
                // 기본 프롬프트 identifier들은 제외
                if (defaultPromptIdentifiers.includes(prompt.identifier)) {
                    return false;
                }
                return true;
            });
            
            // 누락된 프롬프트들을 prompt_order에 추가 (기본값: enabled: true)
            if (missingPrompts.length > 0) {
                missingPrompts.forEach(prompt => {
                    promptOrder.push({
                        identifier: prompt.identifier,
                        enabled: true, // 기본값은 활성화
                    });
                    this.log(`Auto-added prompt ${prompt.identifier} to prompt_order`);
                });
                
                // 업데이트된 prompt_order 저장
                this.addPromptOrderForCharacter(dummyCharacter, promptOrder);
            }
        }
    }

    /**
     * 누락된 프롬프트 확인 및 추가
     * @param {Array} prompts - 프롬프트 배열
     */
    checkForMissingPrompts(prompts) {
        const defaultPromptIdentifiers = chatCompletionDefaultPrompts.prompts.map(p => p.identifier);

        const missingIdentifiers = defaultPromptIdentifiers.filter(identifier =>
            !prompts.some(prompt => prompt.identifier === identifier)
        );

        missingIdentifiers.forEach(identifier => {
            const defaultPrompt = chatCompletionDefaultPrompts.prompts.find(p => p.identifier === identifier);
            if (defaultPrompt) {
                prompts.push(structuredClone(defaultPrompt));
                this.log(`Missing system prompt: ${identifier}. Added default.`);
            }
        });
    }

    /**
     * 프롬프트 ID로 프롬프트 찾기
     * @param {string} identifier - 프롬프트 식별자
     * @returns {Object|undefined} 프롬프트 객체
     */
    getPromptById(identifier) {
        if (!this.serviceSettings || !this.serviceSettings.prompts) {
            return undefined;
        }
        return this.serviceSettings.prompts.find(p => p.identifier === identifier);
    }

    /**
     * 프롬프트 ID로 인덱스 찾기
     * @param {string} identifier - 프롬프트 식별자
     * @returns {number} 인덱스 또는 -1
     */
    getPromptIndexById(identifier) {
        if (!this.serviceSettings || !this.serviceSettings.prompts) {
            return -1;
        }
        return this.serviceSettings.prompts.findIndex(p => p.identifier === identifier);
    }

    /**
     * 캐릭터별 프롬프트 순서 가져오기
     * @param {Object} character - 캐릭터 객체 ({ id: ... } 또는 { id: ..., name: ... })
     * @returns {Array} 프롬프트 순서 배열
     */
    getPromptOrderForCharacter(character) {
        // 실리태번과 동일: character가 없으면 빈 배열 반환
        if (!character) {
            return [];
        }

        if (!this.serviceSettings || !this.serviceSettings.prompt_order) {
            // prompt_order가 없으면 빈 배열 반환 (실리태번과 동일)
            return [];
        }

        const characterId = character?.id;
        if (!characterId) {
            // characterId가 없으면 빈 배열 반환
            return [];
        }

        // 실리태번과 동일하게 String으로 변환하여 비교
        const orderEntry = this.serviceSettings.prompt_order.find(
            entry => String(entry.character_id) === String(characterId)
        );

        // 실리태번과 동일: orderEntry?.order ?? []
        const result = orderEntry?.order ?? [];
        return result;
    }

    /**
     * 프롬프트 순서 엔트리 가져오기
     * @param {Object} character - 캐릭터 객체
     * @param {string} identifier - 프롬프트 식별자
     * @returns {Object|undefined} 프롬프트 순서 엔트리
     */
    getPromptOrderEntry(character, identifier) {
        const order = this.getPromptOrderForCharacter(character);
        return order.find(entry => entry.identifier === identifier);
    }

    /**
     * 캐릭터별 프롬프트 목록 가져오기
     * @param {Object} character - 캐릭터 객체
     * @returns {Array} 프롬프트 배열
     */
    getPromptsForCharacter(character) {
        if (!this.serviceSettings || !this.serviceSettings.prompts) {
            return [];
        }

        const order = this.getPromptOrderForCharacter(character);
        const prompts = [];

        order.forEach(orderEntry => {
            const prompt = this.getPromptById(orderEntry.identifier);
            if (prompt) {
                prompts.push(prompt);
            }
        });

        return prompts;
    }

    /**
     * 프롬프트 순서에 캐릭터 추가
     * @param {Object} character - 캐릭터 객체
     * @param {Array} order - 프롬프트 순서 배열
     */
    addPromptOrderForCharacter(character, order) {
        if (!this.serviceSettings.prompt_order) {
            this.serviceSettings.prompt_order = [];
        }

        const characterId = character?.id;
        if (!characterId) {
            return;
        }

        // 실리태번과 동일하게 String으로 비교
        const existingIndex = this.serviceSettings.prompt_order.findIndex(
            entry => String(entry.character_id) === String(characterId)
        );

        if (existingIndex >= 0) {
            // 기존 항목이 있으면 교체 (실리태번은 항상 push하지만, 우리는 교체 방식 사용)
            this.serviceSettings.prompt_order[existingIndex].order = JSON.parse(JSON.stringify(order));
        } else {
            // 없으면 추가
            this.serviceSettings.prompt_order.push({
                character_id: characterId,
                order: JSON.parse(JSON.stringify(order)), // 실리태번과 동일하게 deep clone
            });
        }
    }

    /**
     * 캐릭터의 프롬프트 순서 제거
     * @param {Object} character - 캐릭터 객체
     */
    removePromptOrderForCharacter(character) {
        if (!this.serviceSettings.prompt_order) {
            return;
        }

        const characterId = character?.id;
        if (!characterId) {
            return;
        }

        const index = this.serviceSettings.prompt_order.findIndex(
            entry => entry.character_id === characterId
        );

        if (index >= 0) {
            this.serviceSettings.prompt_order.splice(index, 1);
        }
    }

    /**
     * 프롬프트 내보내기 (실리태번 파일 구조)
     * @param {Object} data - 내보내기 데이터
     * @param {string} type - 타입 ('full' 또는 'character')
     * @param {string} name - 파일명 (날짜 추가됨)
     */
    async export(data, type, name = 'export') {
        const promptExport = {
            version: this.configuration.version,
            type: type,
            data: data,
        };

        const serializedObject = JSON.stringify(promptExport, null, 4);
        const blob = new Blob([serializedObject], { type: 'application/json' });
        const dateString = this.getFormattedDate();
        const fileName = `${name}-${dateString}.json`;
        
        // downloadBlob 함수 사용 (저장 위치 선택 가능)
        const downloadBlobFunc = typeof window !== 'undefined' && window.downloadBlobUtil ? window.downloadBlobUtil : null;
        let downloadSuccess = false;
        if (downloadBlobFunc) {
            downloadSuccess = await downloadBlobFunc(blob, fileName);
        } else {
            // 폴백: 기본 다운로드 방식
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = fileName;
            downloadLink.click();
            URL.revokeObjectURL(url);
            downloadSuccess = true; // 기본 다운로드 방식은 항상 성공으로 간주
        }
        // 프롬프트 내보내기는 성공/취소 여부를 반환하지 않으므로 여기서는 로깅만 함
    }

    /**
     * 프롬프트 설정
     * @param {Array} prompts - 프롬프트 배열
     */
    setPrompts(prompts) {
        this.serviceSettings.prompts = prompts;
    }

    /**
     * 프롬프트 가져오기 (실리태번 파일 구조)
     * @param {Object} importData - 가져올 데이터
     */
    async import(importData) {
        const mergeKeepNewer = (prompts, newPrompts) => {
            let merged = [...prompts, ...newPrompts];

            let map = new Map();
            for (let obj of merged) {
                map.set(obj.identifier, obj);
            }

            merged = Array.from(map.values());

            return merged;
        };

        const controlObj = {
            version: 1,
            type: '',
            data: {
                prompts: [],
                prompt_order: null,
            },
        };

        if (false === this.validateObject(controlObj, importData)) {
            showToast('Could not import prompts. Export failed validation.', 'error');
            return;
        }

        const prompts = mergeKeepNewer(this.serviceSettings.prompts, importData.data.prompts);

        this.setPrompts(prompts);
        this.log('Prompt import succeeded');

        if ('global' === this.configuration.promptOrder.strategy) {
            const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
            if (Array.isArray(importData.data.prompt_order) && importData.data.prompt_order.length > 0) {
                // 배열인 경우 직접 교체 (실리태번과 동일)
                this.addPromptOrderForCharacter(dummyCharacter, importData.data.prompt_order);
                this.log('Prompt order import succeeded');
            } else if (importData.data.prompt_order && !Array.isArray(importData.data.prompt_order)) {
                // 객체인 경우: 실리태번은 Object.assign을 사용하지만, 우리는 배열만 지원
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20004', 'prompt_order가 배열이 아님, 무시');
                }
                this.log('Prompt order import skipped (not an array)');
            } else {
                // prompt_order가 없거나 비어있으면, 불러온 프롬프트를 prompt_order에 추가
                const currentPromptOrder = this.getPromptOrderForCharacter(dummyCharacter);
                
                if (importData.data.prompts && importData.data.prompts.length > 0) {
                    // 기존 prompt_order를 유지하면서 새로운 프롬프트 추가
                    const updatedOrder = [...currentPromptOrder];
                    
                    importData.data.prompts.forEach(importedPrompt => {
                        // system_prompt나 marker가 아닌 사용자 정의 프롬프트만 추가
                        if (!importedPrompt.system_prompt && !importedPrompt.marker) {
                            const exists = updatedOrder.find(entry => entry.identifier === importedPrompt.identifier);
                            if (!exists) {
                                updatedOrder.push({
                                    identifier: importedPrompt.identifier,
                                    enabled: true,
                                });
                            }
                        }
                    });
                    
                    // 업데이트된 order를 저장
                    this.addPromptOrderForCharacter(dummyCharacter, updatedOrder);
                    this.log('Imported prompts added to prompt order');
                }
            }
            
            // import 후 sanitizeServiceSettings를 호출하여 누락된 프롬프트를 자동으로 prompt_order에 추가 (안전장치)
            this.sanitizeServiceSettings();
        } else if ('character' === this.configuration.promptOrder.strategy) {
            if ('character' === importData.type && this.activeCharacter) {
                const promptOrder = this.getPromptOrderForCharacter(this.activeCharacter);
                if (Array.isArray(importData.data.prompt_order) && importData.data.prompt_order.length > 0) {
                    // 배열인 경우 직접 교체
                    promptOrder.length = 0;
                    promptOrder.push(...importData.data.prompt_order);
                    this.log('Prompt order import succeeded');
                } else if (importData.data.prompt_order && !Array.isArray(importData.data.prompt_order)) {
                    // 객체인 경우 Object.assign (하위 호환성)
                    Object.assign(promptOrder, importData.data.prompt_order);
                    this.log('Prompt order import succeeded (object)');
                } else {
                    // prompt_order가 없으면 불러온 프롬프트를 추가
                    importData.data.prompts.forEach(importedPrompt => {
                        if (!importedPrompt.system_prompt && !importedPrompt.marker) {
                            const exists = promptOrder.find(entry => entry.identifier === importedPrompt.identifier);
                            if (!exists) {
                                promptOrder.push({
                                    identifier: importedPrompt.identifier,
                                    enabled: true,
                                });
                            }
                        }
                    });
                    this.log('Imported prompts added to prompt order');
                }
                const charName = this.activeCharacter?.name || this.activeCharacter?.data?.name || 'character';
                this.log(`Prompt order import for character ${charName} succeeded`);
            }
            
            // import 후 sanitizeServiceSettings를 호출하여 누락된 프롬프트를 자동으로 prompt_order에 추가 (안전장치)
            this.sanitizeServiceSettings();
        } else {
            throw new Error('Prompt order strategy not supported.');
        }

        // 성공 메시지 표시 및 렌더링
        this.log('Prompt import complete.');
        await this.saveServiceSettings();
        await this.render();
    }

    /**
     * 프롬프트 토글이 허용되는지 확인
     * @param {Object} prompt - 프롬프트 객체
     * @returns {boolean}
     */
    isPromptToggleAllowed(prompt) {
        // toggleDisabled에 포함된 식별자는 토글 불가
        if (this.configuration.toggleDisabled && this.configuration.toggleDisabled.includes(prompt.identifier)) {
            return false;
        }
        // marker 프롬프트는 토글 불가
        if (prompt.marker) {
            return false;
        }
        return true;
    }

    /**
     * 프롬프트 편집이 허용되는지 확인
     * @param {Object} prompt - 프롬프트 객체
     * @returns {boolean}
     */
    isPromptEditAllowed(prompt) {
        // marker 프롬프트는 편집 불가 (실리태번과 동일)
        if (prompt.marker) {
            return false;
        }
        return true;
    }

    /**
     * 프롬프트 검사가 허용되는지 확인
     * @param {Object} prompt - 프롬프트 객체
     * @returns {boolean}
     */
    isPromptInspectionAllowed(prompt) {
        // TODO: messages.hasItemWithIdentifier 구현 후 실제 로직 추가
        // 현재는 모든 프롬프트에 대해 false 반환
        return false;
    }

    /**
     * 프롬프트 삭제가 허용되는지 확인
     * @param {Object} prompt - 프롬프트 객체
     * @returns {boolean}
     */
    isPromptDeletionAllowed(prompt) {
        // system_prompt가 true이고 identifier가 시스템 프롬프트 식별자인 경우 삭제 불가
        if (prompt.system_prompt && this.systemPrompts.includes(prompt.identifier)) {
            return false;
        }
        // marker 프롬프트는 삭제 불가
        if (prompt.marker) {
            return false;
        }
        return true;
    }

    /**
     * 객체 검증
     * @param {Object} controlObj - 제어 객체
     * @param {Object} object - 검증할 객체
     * @returns {boolean}
     */
    validateObject(controlObj, object) {
        for (let key in controlObj) {
            if (!Object.hasOwn(object, key)) {
                if (controlObj[key] === null) continue;
                else return false;
            }

            if (typeof controlObj[key] === 'object' && controlObj[key] !== null) {
                if (typeof object[key] !== 'object') return false;
                if (!this.validateObject(controlObj[key], object[key])) return false;
            } else {
                if (typeof object[key] !== typeof controlObj[key]) return false;
            }
        }

        return true;
    }

    /**
     * 날짜 포맷팅 (MM_DD_YYYY)
     * @returns {string}
     */
    getFormattedDate() {
        const date = new Date();
        let month = String(date.getMonth() + 1);
        let day = String(date.getDate());
        const year = String(date.getFullYear());

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return `${month}_${day}_${year}`;
    }

    /**
     * UUID v4 가져오기
     * @returns {string}
     */
    getUuidv4() {
        return uuidv4();
    }

    /**
     * 로그 출력
     * @param {string} message - 로그 메시지
     */
    log(message) {
        // 로그는 내부적으로만 사용 (필요시 console.log로 변경 가능)
        // console.log(`[PromptManager] ${message}`);
    }

    /**
     * 프롬프트 비활성화 여부 확인 (캐릭터별)
     * @param {string} identifier - 프롬프트 식별자
     * @returns {boolean}
     */
    isPromptDisabledForActiveCharacter(identifier) {
        if (!this.activeCharacter) {
            return false;
        }

        const orderEntry = this.getPromptOrderEntry(this.activeCharacter, identifier);
        return orderEntry ? !orderEntry.enabled : false;
    }

    /**
     * 프롬프트 준비 (변수 치환)
     * 실리태번의 preparePrompt 함수와 동일
     * @param {Object} prompt - 프롬프트 객체
     * @param {string} [original] - 원본 메시지 ({{original}}용)
     * @returns {Prompt} 준비된 프롬프트
     */
    preparePrompt(prompt, original = null) {
        const preparedPrompt = new Prompt(prompt);

        // configuration에서 name1, name2 가져오기 ({{user}}, {{char}} 치환용)
        // init()에서 moduleConfiguration이 this.configuration에 병합되므로 여기서 참조
        const name1 = this.configuration?.name1 || '';
        const name2 = this.configuration?.name2 || '';

        if (typeof original === 'string') {
            preparedPrompt.content = substituteParams(prompt.content ?? '', name1, name2, original);
        } else {
            preparedPrompt.content = substituteParams(prompt.content ?? '', name1, name2);
        }

        return preparedPrompt;
    }

    /**
     * 프롬프트 컬렉션 가져오기
     * 실리태번의 getPromptCollection 함수와 동일
     * @param {string} [generationType='normal'] - 생성 타입 (normal, continue, swipe, regenerate, impersonate, quiet)
     * @returns {PromptCollection} 프롬프트 컬렉션
     */
    getPromptCollection(generationType = 'normal') {
        generationType = String(generationType || 'normal').toLowerCase().trim();
        const promptCollection = new PromptCollection();
        
        // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 순서 사용
        const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
        const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);

        // prompt_order에 포함된 프롬프트들 먼저 처리 (순서 보장)
        const processedIdentifiers = new Set();
        
        promptOrder.forEach((entry, index) => {
            const prompt = this.getPromptById(entry.identifier);
            const allowedTrigger = entry.enabled && this.shouldTrigger(prompt, generationType);

            if (!prompt) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20005', `프롬프트를 찾을 수 없음 (prompt_order에는 있음): ${entry.identifier}`);
                }
                return;
            }

            if (allowedTrigger) {
                // 빈 content 프롬프트는 건너뛰기 (실리태번과 동일)
                // 단, marker 프롬프트(chatHistory, dialogueExamples 등)는 나중에 populateChatHistory 등에서 채워지므로 예외
                if (!prompt.content || prompt.content.trim() === '') {
                    // main 프롬프트와 marker 프롬프트는 예외 (확장 기능을 위해 빈 content로도 추가 가능)
                    if (entry.identifier !== 'main' && !prompt.marker) {
                        // 디버깅: 빈 내용의 프롬프트 건너뛰기
                        console.debug('[PromptManager] 빈 내용의 프롬프트 건너뛰기:', entry.identifier);
                        return;
                    }
                }
                
                // role이 없으면 기본값 'system' 설정
                if (!prompt.role) {
                    prompt.role = 'system';
                }
                
                promptCollection.add(this.preparePrompt(prompt));
                processedIdentifiers.add(entry.identifier);
            } else if (entry.identifier === 'main') {
                // main 프롬프트는 확장 기능을 위해 내용만 비운 채로 추가
                const replacementPrompt = structuredClone(prompt);
                replacementPrompt.content = '';
                promptCollection.add(this.preparePrompt(replacementPrompt));
                processedIdentifiers.add(entry.identifier);
            }
        });

        // prompt_order에 없는 사용자 추가 프롬프트들도 포함 (실리태번과 동일: 프롬프트 추가 시 prompt_order에도 자동 추가되어야 하지만, 누락된 경우를 대비)
        // system_prompt가 false이고 marker가 아닌 프롬프트들만 추가 (사용자 정의 프롬프트)
        const allPrompts = this.serviceSettings?.prompts || [];
        const userAddedPrompts = allPrompts.filter(prompt => {
            // 이미 처리된 프롬프트는 제외
            if (processedIdentifiers.has(prompt.identifier)) {
                return false;
            }
            // system_prompt나 marker 프롬프트는 제외 (이미 prompt_order에 포함되어 있어야 함)
            if (prompt.system_prompt || prompt.marker) {
                return false;
            }
            // 기본 프롬프트 identifier들도 제외 (이미 처리됨)
            const defaultIdentifiers = ['main', 'nsfw', 'jailbreak', 'worldInfoBefore', 'worldInfoAfter', 
                                       'charDescription', 'charPersonality', 'scenario', 'personaDescription',
                                       'enhanceDefinitions', 'dialogueExamples', 'chatHistory', 'impersonate',
                                       'quietPrompt', 'groupNudge', 'bias'];
            if (defaultIdentifiers.includes(prompt.identifier)) {
                return false;
            }
            return true;
        });

        // prompt_order에 없는 사용자 추가 프롬프트 처리
        // 주의: sanitizeServiceSettings에서 자동으로 prompt_order에 추가되므로, 여기서 발견되는 경우는 드물어야 함
        // 하지만 안전을 위해 여전히 포함시킴 (enabled 상태는 기본값 true로 가정)
        if (userAddedPrompts.length > 0) {
            // 디버깅: 사용자 추가 프롬프트가 prompt_order에 없음
            console.debug('[PromptManager] 사용자 추가 프롬프트가 prompt_order에 없음:', userAddedPrompts.length, '개');
            
            // 동시에 prompt_order에도 자동 추가 (다음 번에는 포함되도록)
            const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
            const currentPromptOrder = this.getPromptOrderForCharacter(dummyCharacter);
            const needsUpdate = [];
            
            userAddedPrompts.forEach(prompt => {
                // enabled 상태 확인 (prompt_order에 없으면 기본적으로 enabled로 가정)
                if (!prompt.content || prompt.content.trim() === '') {
                    // 디버깅: 빈 내용의 프롬프트 건너뛰기
                    console.debug('[PromptManager] 빈 내용의 프롬프트 건너뛰기:', prompt.identifier);
                    return;
                }
                
                if (!prompt.role) {
                    prompt.role = 'system';
                }
                
                const allowedTrigger = this.shouldTrigger(prompt, generationType);
                if (allowedTrigger) {
                    promptCollection.add(this.preparePrompt(prompt));
                    // prompt_order에도 추가 (다음 번에는 포함되도록)
                    const alreadyInOrder = currentPromptOrder.some(e => e.identifier === prompt.identifier);
                    if (!alreadyInOrder) {
                        needsUpdate.push({
                            identifier: prompt.identifier,
                            enabled: true,
                        });
                    }
                }
            });
            
            // prompt_order 업데이트 (비동기적으로 실행하여 현재 호출에는 영향을 주지 않음)
            if (needsUpdate.length > 0) {
                setTimeout(() => {
                    const updatedOrder = [...currentPromptOrder, ...needsUpdate];
                    this.addPromptOrderForCharacter(dummyCharacter, updatedOrder);
                    // 설정 저장은 saveServiceSettings가 나중에 호출될 때 저장됨
                }, 0);
            }
        }

        return promptCollection;
    }

    /**
     * 트리거 확인
     * 실리태번의 shouldTrigger 함수와 동일
     * @param {Object} prompt - 프롬프트 객체
     * @param {string} generationType - 생성 타입
     * @returns {boolean}
     */
    shouldTrigger(prompt, generationType) {
        if (!prompt || !Array.isArray(prompt.injection_trigger)) {
            return true;
        }
        if (!prompt.injection_trigger.length) {
            return true;
        }
        return prompt.injection_trigger.includes(generationType);
    }

    /**
     * 렌더링 메인 함수
     * 실리태번의 render 함수와 동일
     * @param {boolean} [afterTryGenerate=true] - Dry-run 생성 후 렌더링 여부
     */
    async render(afterTryGenerate = true) {
        // 실리태번과 동일 (866-869번 라인): containerElement가 없으면 조기 종료 (모달이 열려있지 않을 때)
        if (!this.containerElement) {
            // containerElement가 없어도 setChatCompletion은 이미 호출되었으므로 토큰 카운트는 업데이트됨
            return;
        }
        
        // append_prompt select의 현재 선택 값 저장 (this.selectedPromptId 우선, 없으면 현재 선택 값)
        const appendPromptSelect = document.getElementById(`${this.configuration.prefix}prompt_manager_footer_append_prompt`);
        const savedPromptId = this.selectedPromptId || (appendPromptSelect ? appendPromptSelect.value : '');
        
        // 토큰 계산은 모달이 열릴 때만 수행 (사용자 요청)
        // promptsTemplatesPanel.js에서 모달 열 때 tryGenerate를 호출하므로
        // 여기서는 자동 호출하지 않음
        if (false && afterTryGenerate && this.tryGenerate) {
            // 비활성화: 모달이 열릴 때만 토큰 계산 수행
            // tryGenerate를 먼저 호출하여 토큰 계산 (실리태번과 동일)
            try {
                await this.tryGenerate();
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_PROMPT_8001', 'tryGenerate 오류', error);
                }
            }
        }
        
        await this.renderPromptManager();
        await this.renderPromptManagerListItems();
        this.makeDraggable();
        
        // 저장된 append_prompt select 값 복원
        if (savedPromptId) {
            const restoredSelect = document.getElementById(`${this.configuration.prefix}prompt_manager_footer_append_prompt`);
            if (restoredSelect) {
                // 옵션이 존재하는지 확인 후 값 복원
                const options = Array.from(restoredSelect.options);
                const optionExists = options.some(opt => opt.value === savedPromptId);
                if (optionExists) {
                    restoredSelect.value = savedPromptId;
                    // this.selectedPromptId도 업데이트하여 동기화 유지
                    this.selectedPromptId = savedPromptId;
                }
            }
        }
    }

    /**
     * ChatCompletion 설정 및 토큰 카운트 업데이트 (실리태번과 동일)
     * @param {ChatCompletion} chatCompletion - ChatCompletion 인스턴스
     */
    setChatCompletion(chatCompletion) {
        const messages = chatCompletion.getMessages();
        this.messages = messages;
        this.populateTokenCounts(messages);
        this.overriddenPrompts = chatCompletion.getOverriddenPrompts();
    }

    /**
     * 토큰 핸들러에 토큰 카운트 채우기 (실리태번과 동일)
     * @param {MessageCollection} messages - MessageCollection 인스턴스
     */
    populateTokenCounts(messages) {
        // 실리태번과 동일 (1592-1602번 라인)
        if (!this.tokenHandler) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20008', 'tokenHandler가 없음');
            }
            return;
        }
        
        this.tokenHandler.resetCounts();
        const counts = this.tokenHandler.getCounts();
        
        const messageCollection = messages.getCollection();
        
        // 실리태번과 동일: getCollection() 사용하고 각 메시지의 identifier와 getTokens() 사용
        messageCollection.forEach(message => {
            if (message && message.identifier && typeof message.getTokens === 'function') {
                const tokens = message.getTokens();
                counts[message.identifier] = tokens;
            } else {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20009', '메시지 건너뛰기 (토큰 카운팅)');
                }
            }
        });

        // counts 객체 업데이트를 tokenHandler에 명시적으로 반영
        this.tokenHandler.setCounts(counts);
        
        this.tokenUsage = this.tokenHandler.getTotal();
        this.log('Updated token usage with ' + this.tokenUsage);
        
        // UI 업데이트: Total Tokens 요소 업데이트
        this.updateTokenDisplay();
    }
    
    /**
     * 토큰 표시 UI 업데이트
     */
    updateTokenDisplay() {
        if (!this.containerElement) return;
        
        const totalTokensElement = document.getElementById(`${this.configuration.prefix}prompt_manager_total_tokens`);
        if (totalTokensElement) {
            const totalTokens = this.tokenUsage || (this.tokenHandler ? this.tokenHandler.getTotal() : 0);
            totalTokensElement.innerHTML = `<span>Total Tokens:</span> ${totalTokens}`;
        }
        
        // 각 프롬프트 항목의 토큰도 업데이트
        if (this.listElement) {
            const listItems = this.listElement.querySelectorAll(`li[data-pm-identifier]`);
            listItems.forEach(item => {
                const identifier = item.getAttribute('data-pm-identifier');
                if (identifier && this.tokenHandler) {
                    const tokens = this.tokenHandler.getCounts()[identifier] ?? 0;
                    const tokenSpan = item.querySelector('.prompt_manager_prompt_tokens');
                    if (tokenSpan) {
                        const displayValue = (typeof tokens === 'number' && tokens > 0) ? tokens : '-';
                        tokenSpan.textContent = displayValue;
                        tokenSpan.setAttribute('data-pm-tokens', tokens);
                    }
                }
            });
        }
    }

    /**
     * 프롬프트 매니저 헤더/푸터 렌더링
     * 실리태번의 renderPromptManager 함수와 동일
     */
    async renderPromptManager() {
        if (!this.containerElement) return;

        const promptManagerDiv = this.containerElement;
        promptManagerDiv.innerHTML = '';

        const errorDiv = this.error ? `
            <div class="${this.configuration.prefix}prompt_manager_error">
                <span class="fa-solid fa-triangle-exclamation" style="color: var(--danger-color);"></span> ${this.error}
            </div>
        ` : '';

        // tokenUsage는 populateTokenCounts에서 이미 계산되므로 초기화하지 않음
        // 만약 아직 계산되지 않았다면 0으로 표시
        const totalActiveTokens = this.tokenUsage || 0;

        // 헤더 HTML 생성 (리스트는 제외)
        const headerHtml = `
            <div class="range-block">
                ${errorDiv}
                <div class="${this.configuration.prefix}prompt_manager_header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
                    <div class="${this.configuration.prefix}prompt_manager_header_advanced">
                        <span>Prompts</span>
                    </div>
                    <div id="${this.configuration.prefix}prompt_manager_total_tokens">
                        <span>Total Tokens:</span> ${totalActiveTokens}
                    </div>
                </div>
            </div>
        `;
        promptManagerDiv.insertAdjacentHTML('beforeend', headerHtml);

        const headerDiv = promptManagerDiv.querySelector(`.${this.configuration.prefix}prompt_manager_header`);

        // 푸터를 헤더 바로 아래에 추가 (실리태번처럼)
        if (null !== this.activeCharacter && headerDiv) {
            const footerHtml = await this.renderPromptManagerFooter();
            headerDiv.insertAdjacentHTML('afterend', footerHtml);
        }

        // 리스트는 푸터 아래에 추가
        const listHtml = `<ul id="${this.configuration.prefix}prompt_manager_list" class="text_pole" style="list-style: none; padding: 0; margin: 0;"></ul>`;
        promptManagerDiv.insertAdjacentHTML('beforeend', listHtml);

        this.listElement = promptManagerDiv.querySelector(`#${this.configuration.prefix}prompt_manager_list`);
        
        // listElement가 없으면 직접 DOM에서 찾기 시도
        if (!this.listElement) {
            const listId = `${this.configuration.prefix}prompt_manager_list`;
            this.listElement = document.getElementById(listId);
        }
    }

    /**
     * 프롬프트 매니저 푸터 렌더링
     * 실리태번의 renderPromptManagerFooter 함수와 동일
     */
    async renderPromptManagerFooter() {
        // 사용자 정의 프롬프트 목록 가져오기
        const userPrompts = (this.serviceSettings?.prompts || []).filter(p => {
            return !this.systemPrompts.includes(p.identifier);
        });

        const promptsHtml = userPrompts.map(prompt => {
            return `<option value="${this.escapeHtml(prompt.identifier || '')}">${this.escapeHtml(prompt.name || 'Unnamed')}</option>`;
        }).join('');

        return `
            <div class="${this.configuration.prefix}prompt_manager_footer" style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-md); align-items: center; flex-wrap: nowrap;">
                <!-- 프롬프트 추가 드롭다운 -->
                <select id="${this.configuration.prefix}prompt_manager_footer_append_prompt" class="text_pole" name="append-prompt" style="flex: 1; min-width: 0; max-width: 300px;">
                    <option value="">Select prompt to add...</option>
                    ${promptsHtml}
                </select>
                
                <!-- Insert prompt 버튼 -->
                <a class="menu_button fa-chain fa-solid fa-fw" title="Insert prompt" href="#" onclick="event.preventDefault(); return false;"></a>
                
                <!-- Delete prompt 버튼 -->
                <a class="caution menu_button fa-x fa-solid fa-fw" title="Delete prompt" href="#" onclick="event.preventDefault(); return false;"></a>
                
                <!-- Import 버튼 -->
                <a class="menu_button fa-file-import fa-solid fa-fw" id="prompt-manager-import" title="Import a prompt list" href="#" onclick="event.preventDefault(); return false;"></a>
                
                <!-- Export 버튼 -->
                <a class="menu_button fa-file-export fa-solid fa-fw" id="prompt-manager-export" title="Export this prompt list" href="#" onclick="event.preventDefault(); return false;"></a>
                
                <!-- Reset character 버튼 -->
                <a class="menu_button fa-undo fa-solid fa-fw" id="prompt-manager-reset-character" title="Reset current character" href="#" onclick="event.preventDefault(); return false;"></a>
                
                <!-- New prompt 버튼 -->
                <a class="menu_button fa-plus-square fa-solid fa-fw" title="New prompt" href="#" onclick="event.preventDefault(); return false;"></a>
            </div>
        `;
    }

    /**
     * 프롬프트 리스트 항목 렌더링
     * 실리태번의 renderPromptManagerListItems 함수와 동일
     */
    async renderPromptManagerListItems() {
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
        // chatManager.currentCharacterId가 없으면 currentCharacterId는 null로 유지
        // 이렇게 하면 프롬프트 모달이 잘못된 캐릭터로 연결되는 것을 방지
        
        // UI에서 실제로 캐릭터가 선택되어 있는지 확인
        // 1. char-name 요소 확인 (기본값 "캐릭터를 선택하세요"가 아닌지)
        const charNameElement = document.querySelector('#char-name');
        const charNameText = charNameElement ? charNameElement.textContent.trim() : '';
        const isCharacterNameSet = charNameElement && 
                                   charNameText !== '' && 
                                   charNameText !== '캐릭터를 선택하세요';
        
        // 2. app 인스턴스의 isCharacterSelected 플래그 확인 (가능한 경우)
        let isCharacterSelectedInApp = false;
        try {
            // window.app 또는 전역 app 인스턴스 확인
            if (typeof window !== 'undefined' && window.app) {
                isCharacterSelectedInApp = window.app.isCharacterSelected === true;
            }
        } catch (e) {
            // app 인스턴스에 접근할 수 없으면 무시
        }
        
        // 3. ChatManager에서 채팅이 열려 있는지 확인 (채팅이 열려 있으면 캐릭터가 선택된 것으로 간주)
        let isChatOpen = false;
        try {
            if (typeof window !== 'undefined' && window.chatManager) {
                // 채팅이 열려 있으면 (currentChatId가 있거나 currentCharacterId가 있으면)
                isChatOpen = !!(window.chatManager.currentChatId || window.chatManager.currentCharacterId);
            }
        } catch (e) {
            // chatManager에 접근할 수 없으면 무시
        }
        
        // 세 조건 중 하나라도 true이면 캐릭터가 선택된 것으로 간주
        const isCharacterSelectedInUI = isCharacterNameSet || isCharacterSelectedInApp || isChatOpen;
        
        // ⚠️ 디버깅: renderPromptManagerListItems에서 캐릭터 정보 확인
        console.log('[PromptManager.renderPromptManagerListItems] 캐릭터 정보:', {
            currentCharacterId: currentCharacterId,
            isCharacterSelectedInUI: isCharacterSelectedInUI,
            isChatOpen: isChatOpen,
            chatManagerCurrentCharacterId: window.chatManager?.currentCharacterId
        });
        
        // UI에 캐릭터가 선택되어 있고 저장소에도 캐릭터 ID가 있을 때만 로드
        if (currentCharacterId && isCharacterSelectedInUI) {
            const character = await CharacterStorage.load(currentCharacterId);
            if (character) {
                // 캐릭터 ID를 activeCharacter에 추가
                // ⚠️ 중요: activeCharacter를 설정할 때 CharacterStorage.saveCurrent()를 호출하지 않음
                this.activeCharacter = { ...character, id: currentCharacterId };
                console.log('[PromptManager.renderPromptManagerListItems] activeCharacter 설정:', {
                    characterId: currentCharacterId,
                    characterName: character.name || character.data?.name
                });
            } else {
                // 캐릭터를 찾을 수 없으면 더미 ID로 리셋하고 저장소도 초기화
                // 단, 채팅이 열려 있으면 저장소를 초기화하지 않음 (채팅이 끊기지 않도록)
                if (!isChatOpen) {
                await CharacterStorage.clearCurrent();
                }
                this.activeCharacter = { id: this.configuration.promptOrder.dummyId };
            }
        } else {
            // UI에 캐릭터가 선택되지 않았거나 저장소에 ID가 없으면 더미 ID로 리셋
            // 저장소에 ID가 있지만 UI에 선택되지 않았다면 저장소도 초기화
            // 단, 채팅이 열려 있으면 저장소를 초기화하지 않음 (채팅이 끊기지 않도록)
            if (currentCharacterId && !isCharacterSelectedInUI && !isChatOpen) {
                await CharacterStorage.clearCurrent();
            }
            this.activeCharacter = { id: this.configuration.promptOrder.dummyId };
        }
        
        // 실리태번과 동일 (1664-1667번 라인): serviceSettings.prompts가 없으면 조기 종료
        if (!this.serviceSettings?.prompts) {
            return;
        }
        
        // 실리태번과 동일 (1667번 라인): listElement가 없으면 조기 종료
        const promptManagerList = this.listElement;
        if (!promptManagerList) {
            // listElement가 없으면 renderPromptManager에서 생성되지 않았거나 모달이 닫혀있음
            return;
        }
        
        // 실리태번과 동일 (1668번 라인): listElement 초기화
        promptManagerList.innerHTML = '';

        // 리스트 헤더 추가
        const listHeader = `
            <li class="${this.configuration.prefix}prompt_manager_list_head">
                <span>Name</span>
                <span></span>
                <span class="prompt_manager_prompt_tokens">Tokens</span>
            </li>
            <li class="${this.configuration.prefix}prompt_manager_list_separator">
                <hr>
            </li>
        `;
        this.listElement.insertAdjacentHTML('beforeend', listHeader);

        // 프롬프트 순서 가져오기
        // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 순서 사용
        const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
        const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);

        // promptOrder가 비어있으면 기본 순서 사용
        if (!promptOrder || promptOrder.length === 0) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20010', 'promptOrder가 비어있음, 기본값 사용');
            }
            // 기본 프롬프트 순서 사용
            const defaultOrder = promptManagerDefaultPromptOrder;
            defaultOrder.forEach(entry => {
                let prompt = this.getPromptById(entry.identifier);
                if (!prompt) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_PROMPT_20011', `프롬프트를 찾을 수 없음 (렌더링): ${entry.identifier}`);
                    }
                    // 기본 프롬프트가 없으면 생성
                    const defaultPrompt = chatCompletionDefaultPrompts.prompts.find(p => p.identifier === entry.identifier);
                    if (defaultPrompt) {
                        this.serviceSettings.prompts.push(structuredClone(defaultPrompt));
                        // 추가한 후 다시 가져오기
                        prompt = this.getPromptById(entry.identifier);
                        if (!prompt) {
                            // 오류 코드 토스트 알림 표시
                            if (typeof showErrorCodeToast === 'function') {
                                showErrorCodeToast('ERR_PROMPT_8002', `프롬프트 추가 후 가져오기 실패: ${entry.identifier}`);
                            }
                            return;
                        }
                    } else {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PROMPT_8003', `기본 프롬프트를 찾을 수 없음: ${entry.identifier}`);
                        }
                        return;
                    }
                }

                const listEntry = entry;
                const enabledClass = listEntry.enabled ? '' : `${this.configuration.prefix}prompt_manager_prompt_disabled`;
                const isMarkerPrompt = prompt.marker || false;
                const markerClass = isMarkerPrompt ? `${this.configuration.prefix}prompt_manager_marker` : '';
                const draggableClass = `${this.configuration.prefix}prompt_manager_prompt_draggable`;

                // 토글 버튼
                const canToggle = this.isPromptToggleAllowed(prompt);
                const toggleSpanHtml = canToggle ? `
                    <i class="prompt-manager-toggle-action fa-solid ${listEntry.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                ` : '<span></span>';

                // 편집/검사 버튼
                const canEdit = this.isPromptEditAllowed(prompt);
                const canInspect = this.isPromptInspectionAllowed(prompt);
                
                const editSpanHtml = canEdit ? `
                    <i class="prompt-manager-edit-action fa-solid fa-pencil"></i>
                ` : '';
                
                const inspectSpanHtml = canInspect ? `
                    <i class="prompt-manager-inspect-action fa-solid fa-magnifying-glass"></i>
                ` : '';

                // 이름 표시
                const promptName = prompt.name || 'Unnamed';
                const encodedName = this.escapeHtml(promptName);

                // 토큰 수 계산: tokenHandler에서 먼저 확인 (populateTokenCounts에서 계산된 값)
                let tokenCount = 0;
                
                // tokenHandler가 있으면 먼저 확인
                if (this.tokenHandler) {
                    const handlerCounts = this.tokenHandler.getCounts();
                    tokenCount = handlerCounts[prompt.identifier] ?? 0;
                    
                    // 숫자가 아닌 경우 0으로 처리
                    if (typeof tokenCount !== 'number' || isNaN(tokenCount)) {
                        tokenCount = 0;
                    }
                }
                
                // tokenHandler에 값이 없거나 0이면, 캐릭터별 프롬프트는 캐릭터 데이터로 계산 (실리태번과 동일)
                // 단, tokenHandler에 값이 없을 때만 폴백 계산 수행
                if (tokenCount === 0 && this.tokenHandler && !this.tokenHandler.getCounts()[prompt.identifier] && ['charDescription', 'charPersonality', 'scenario', 'worldInfoBefore', 'worldInfoAfter', 'personaDescription', 'dialogueExamples', 'chatHistory'].includes(prompt.identifier)) {
                    // activeCharacter가 있고, 더미 ID가 아닐 때만 캐릭터 데이터 사용
                    const isDummyCharacter = !this.activeCharacter || 
                                             this.activeCharacter.id === this.configuration.promptOrder.dummyId ||
                                             (!this.activeCharacter.data && !this.activeCharacter.description);
                    
                    if (!isDummyCharacter) {
                        const characterName = this.activeCharacter?.data?.name || this.activeCharacter?.name || '';
                        const fields = getCharacterCardFields(this.activeCharacter, {}, '', characterName);
                        
                        let content = '';
                        if (prompt.identifier === 'charDescription') {
                            content = fields.description || '';
                        } else if (prompt.identifier === 'charPersonality') {
                            content = fields.personality || '';
                        } else if (prompt.identifier === 'scenario') {
                            content = fields.scenario || '';
                        } else if (prompt.identifier === 'dialogueExamples') {
                            // 메시지 예제는 mesExamples 사용
                            content = fields.mesExamples || '';
                        } else if (prompt.identifier === 'personaDescription') {
                            // Persona Description은 설정에서 가져오기
                            // 동기적으로 처리하기 위해 빈 문자열로 처리 (실제 값은 tokenHandler에서 계산됨)
                            content = '';
                        } else if (prompt.identifier === 'chatHistory') {
                            // Chat History는 실제 채팅 메시지들을 계산
                            try {
                                if (window.chatManager && typeof window.chatManager.getChatHistory === 'function') {
                                    const chatHistoryMessages = window.chatManager.getChatHistory();
                                    // 모든 메시지 내용을 합쳐서 계산
                                    content = chatHistoryMessages.map(msg => {
                                        if (typeof msg === 'string') return msg;
                                        return msg.content || '';
                                    }).join('\n');
                                }
                            } catch (error) {
                                content = '';
                            }
                        } else if (prompt.identifier === 'worldInfoBefore' || prompt.identifier === 'worldInfoAfter') {
                            // World Info는 별도로 계산되어야 함 (현재는 빈 문자열로 처리)
                            // 실제로는 getWorldInfoPrompt에서 계산되므로, 여기서는 빈 문자열
                            content = '';
                        }
                        
                        // 내용이 있으면 간단한 추정 (문자 수 / 4)
                        if (content) {
                            tokenCount = Math.ceil(content.length / 4);
                        }
                    } else {
                        // 캐릭터가 선택되지 않았으면 토큰은 0
                        tokenCount = 0;
                    }
                } else if (tokenCount === 0) {
                    // 일반 프롬프트는 prompt.content 사용
                    const content = prompt.content || '';
                    if (content) {
                        tokenCount = Math.ceil(content.length / 4);
                    }
                }
                
                // tokenUsage는 populateTokenCounts에서 이미 계산되므로 여기서 누적하지 않음
                // 대신 tokenHandler에서 직접 읽어온 값을 사용

                const listItemHtml = `
                    <li class="${this.configuration.prefix}prompt_manager_prompt ${draggableClass} ${enabledClass} ${markerClass}" 
                        data-pm-identifier="${this.escapeHtml(prompt.identifier)}">
                        <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                        <span class="${this.configuration.prefix}prompt_manager_prompt_name" data-pm-name="${encodedName}">
                            ${isMarkerPrompt ? '<i class="fa-solid fa-thumbtack"></i> ' : ''}${encodedName}
                        </span>
                        <span class="prompt_manager_prompt_controls">
                            ${inspectSpanHtml}
                            ${editSpanHtml}
                            ${toggleSpanHtml}
                        </span>
                        <span class="prompt_manager_prompt_tokens" data-pm-tokens="${tokenCount}">
                            ${tokenCount}
                        </span>
                    </li>
                `;
                this.listElement.insertAdjacentHTML('beforeend', listItemHtml);
            });
            // 이벤트 리스너 연결
            setTimeout(() => {
                this.connectPromptManagerEventListeners();
                this.makeDraggable();
            }, 0);
            
        // Total Tokens 업데이트
        // tokenUsage는 populateTokenCounts에서 이미 계산되었으므로 그대로 사용
        const totalTokensElement = document.getElementById(`${this.configuration.prefix}prompt_manager_total_tokens`);
        if (totalTokensElement) {
            // populateTokenCounts가 호출되었다면 this.tokenUsage 사용, 아니면 tokenHandler.getTotal() 사용
            const totalTokens = this.tokenUsage || (this.tokenHandler ? this.tokenHandler.getTotal() : 0);
            totalTokensElement.innerHTML = `<span>Total Tokens:</span> ${totalTokens}`;
        }
        return;
        }

        // 실리태번과 동일하게 getPromptsForCharacter 사용
        // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 사용
        const promptsForCharacter = this.getPromptsForCharacter(dummyCharacter);
        
        promptsForCharacter.forEach(prompt => {
            if (!prompt) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20012', '프롬프트가 null/undefined, 건너뛰기');
                }
                return;
            }
            
            const listEntry = this.getPromptOrderEntry(dummyCharacter, prompt.identifier);
            if (!listEntry) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PROMPT_20013', `프롬프트에 대한 order 항목을 찾을 수 없음: ${prompt.identifier}`);
                }
                return;
            }
            const enabledClass = listEntry.enabled ? '' : `${this.configuration.prefix}prompt_manager_prompt_disabled`;
            const isMarkerPrompt = prompt.marker || false;
            const markerClass = isMarkerPrompt ? `${this.configuration.prefix}prompt_manager_marker` : '';
            const draggableClass = `${this.configuration.prefix}prompt_manager_prompt_draggable`;

            // 토글 버튼
            const canToggle = this.isPromptToggleAllowed(prompt);
            const toggleSpanHtml = canToggle ? `
                <i class="prompt-manager-toggle-action fa-solid ${listEntry.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
            ` : '<span></span>';

            // 편집/검사 버튼
            const canEdit = this.isPromptEditAllowed(prompt);
            const canInspect = this.isPromptInspectionAllowed(prompt);
            
            const editSpanHtml = canEdit ? `
                <i class="prompt-manager-edit-action fa-solid fa-pencil"></i>
            ` : '';
            
            const inspectSpanHtml = canInspect ? `
                <i class="prompt-manager-inspect-action fa-solid fa-magnifying-glass"></i>
            ` : '';

            // 이름 표시
            const promptName = prompt.name || 'Unnamed';
            const encodedName = this.escapeHtml(promptName);

            // 토큰 수 계산 (실리태번과 동일)
            // tokenHandler에서 populateTokenCounts로 계산된 값 사용
            const tokens = this.tokenHandler?.getCounts()[prompt.identifier] ?? 0;
            const calculatedTokens = (typeof tokens === 'number' && tokens > 0) ? tokens : '-';
            
            // tokenUsage는 populateTokenCounts에서 이미 계산되므로 여기서 누적하지 않음

            const listItemHtml = `
                <li class="${this.configuration.prefix}prompt_manager_prompt ${draggableClass} ${enabledClass} ${markerClass}" 
                    data-pm-identifier="${this.escapeHtml(prompt.identifier)}">
                    <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                    <span class="${this.configuration.prefix}prompt_manager_prompt_name" data-pm-name="${encodedName}">
                        ${isMarkerPrompt ? '<i class="fa-solid fa-thumbtack"></i> ' : ''}${encodedName}
                    </span>
                    <span class="prompt_manager_prompt_controls">
                        ${inspectSpanHtml}
                        ${editSpanHtml}
                        ${toggleSpanHtml}
                    </span>
                    <span class="prompt_manager_prompt_tokens" data-pm-tokens="${tokens}">
                        ${calculatedTokens}
                    </span>
                </li>
            `;
            this.listElement.insertAdjacentHTML('beforeend', listItemHtml);
        });

        // 이벤트 리스너 연결 (푸터가 렌더링된 후에 호출되도록)
        // setTimeout을 사용하여 DOM이 완전히 렌더링된 후에 이벤트 리스너 연결
        setTimeout(() => {
            this.connectPromptManagerEventListeners();
            this.makeDraggable();
        }, 0);
        
        // Total Tokens 업데이트
        // tokenUsage는 populateTokenCounts에서 이미 계산되었으므로 그대로 사용
        const totalTokensElement = document.getElementById(`${this.configuration.prefix}prompt_manager_total_tokens`);
        if (totalTokensElement) {
            // populateTokenCounts가 호출되었다면 this.tokenUsage 사용, 아니면 tokenHandler.getTotal() 사용
            const totalTokens = this.tokenUsage || (this.tokenHandler ? this.tokenHandler.getTotal() : 0);
            totalTokensElement.innerHTML = `<span>Total Tokens:</span> ${totalTokens}`;
        }
    }

    /**
     * 프롬프트 매니저 이벤트 리스너 연결
     */
    connectPromptManagerEventListeners() {
        if (!this.listElement) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20014', 'listElement가 null');
            }
            return;
        }

        // 기존 이벤트 리스너 제거 (중복 방지)
        const toggleActions = this.listElement.querySelectorAll('.prompt-manager-toggle-action');
        const editActions = this.listElement.querySelectorAll('.prompt-manager-edit-action');
        const inspectActions = this.listElement.querySelectorAll('.prompt-manager-inspect-action');

        // Toggle 버튼
        toggleActions.forEach(el => {
            // 기존 리스너 제거 후 새로 추가
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                this.handleToggle.call(this, e);
            });
        });

        // Edit 버튼
        editActions.forEach(el => {
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                this.handleEdit.call(this, e);
            });
        });

        // Inspect 버튼
        inspectActions.forEach(el => {
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                this.handleInspect.call(this, e);
            });
        });

        // 푸터 버튼들
        const footerDiv = this.containerElement?.querySelector(`.${this.configuration.prefix}prompt_manager_footer`);
        if (footerDiv) {
            // 실리태번처럼 nth-child로 선택하거나 클래스로 선택
            // Insert prompt 버튼 (2번째 자식: .menu_button.fa-chain)
            const insertBtn = footerDiv.querySelector('.menu_button.fa-chain');
            if (insertBtn) {
                insertBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleAppendPrompt.call(this, e);
                });
            }

            // Delete prompt 버튼 (3번째 자식: .caution.menu_button)
            const deleteBtn = footerDiv.querySelector('.caution.menu_button');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleDeletePrompt.call(this, e);
                });
            }

            // New prompt 버튼 (마지막 자식: .menu_button.fa-plus-square)
            const newBtn = footerDiv.querySelector('.menu_button.fa-plus-square');
            if (newBtn) {
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleNewPrompt.call(this, e);
                });
            }

            // Import 버튼
            const importBtn = footerDiv.querySelector('#prompt-manager-import');
            if (importBtn) {
                importBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleImport.call(this, e);
                });
            }

            // Export 버튼
            const exportBtn = footerDiv.querySelector('#prompt-manager-export');
            if (exportBtn) {
                exportBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleFullExport.call(this, e);
                });
            }

            // Reset character 버튼
            const resetBtn = footerDiv.querySelector('#prompt-manager-reset-character');
            if (resetBtn) {
                resetBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleCharacterReset.call(this, e);
                });
            }
            
            // append_prompt select change 이벤트 (select에서 직접 프롬프트 선택 시)
            const appendPromptSelect = footerDiv.querySelector(`#${this.configuration.prefix}prompt_manager_footer_append_prompt`);
            if (appendPromptSelect) {
                appendPromptSelect.addEventListener('change', (e) => {
                    const selectedPromptId = e.target.value;
                    if (selectedPromptId) {
                        // 선택된 프롬프트 ID 저장
                        this.selectedPromptId = selectedPromptId;
                        
                        // 선택된 프롬프트를 편집 모달에 로드
                        const prompt = this.getPromptById(selectedPromptId);
                        if (prompt) {
                            const prefix = this.configuration.prefix;
                            const popup = document.getElementById(`${prefix}prompt_manager_popup`);
                            const isPopupOpen = popup && popup.style.display !== 'none' && !popup.classList.contains('hidden');
                            
                            if (!isPopupOpen) {
                                // 모달이 닫혀있으면 열기
                                this.clearEditForm();
                                this.clearInspectForm();
                                this.loadPromptIntoEditForm(prompt);
                                this.showPopup();
                            } else {
                                // 모달이 열려있으면 내용만 업데이트
                                this.clearInspectForm();
                                const editArea = document.getElementById(`${prefix}prompt_manager_popup_edit`);
                                if (editArea) {
                                    editArea.style.display = 'block';
                                }
                                const inspectArea = document.getElementById(`${prefix}prompt_manager_popup_inspect`);
                                if (inspectArea) {
                                    inspectArea.style.display = 'none';
                                }
                                
                                setTimeout(() => {
                                    this.loadPromptIntoEditForm(prompt);
                                    
                                    // Select2 재초기화
                                    if (typeof $ !== 'undefined' && $.fn.select2) {
                                        const triggerSelect = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
                                        if (triggerSelect) {
                                            if ($(triggerSelect).hasClass('select2-hidden-accessible')) {
                                                $(triggerSelect).select2('destroy');
                                            }
                                            $(triggerSelect).select2({
                                                placeholder: 'All types (default)',
                                                width: '100%',
                                                closeOnSelect: false,
                                            });
                                        }
                                    }
                                }, 10);
                            }
                        }
                    }
                });
            }
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20015', 'Footer div를 찾을 수 없음');
            }
        }

        // 팝업 버튼들
        const popup = document.getElementById(`${this.configuration.prefix}prompt_manager_popup`);
        if (popup) {
            // 팝업의 modal-content 클릭 시 버블링 방지 (패널 모달이 닫히지 않도록)
            // 백그라운드(팝업 자체)는 pointer-events: none이므로 클릭 이벤트가 발생하지 않음
            const popupContent = popup.querySelector('.modal-content');
            if (popupContent) {
                popupContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }

            // 폼 제출 방지
            const forms = popup.querySelectorAll('form');
            forms.forEach(form => {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
            });

            // Save 버튼
            const saveBtn = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_save`);
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault(); // 폼 제출 방지
                    e.stopPropagation(); // 이벤트 버블링 방지
                    this.handleSavePrompt.call(this, e);
                });
            }

            // Reset 버튼
            const resetPromptBtn = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_reset`);
            if (resetPromptBtn) {
                resetPromptBtn.addEventListener('click', (e) => {
                    e.preventDefault(); // 폼 제출 방지
                    e.stopPropagation(); // 이벤트 버블링 방지
                    this.handleResetPrompt.call(this, e);
                });
            }

            // Close 버튼들
            const closeAndClearPopup = (e) => {
                if (e) {
                    e.preventDefault(); // 폼 제출 방지
                    e.stopPropagation(); // 이벤트 버블링 방지
                }
                this.hidePopup();
                this.clearEditForm();
                this.clearInspectForm();
            };

            const closeBtn = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_entry_form_close`);
            if (closeBtn) {
                closeBtn.addEventListener('click', closeAndClearPopup);
            }

            const closePopupBtn = document.getElementById(`${this.configuration.prefix}prompt_manager_popup_close_button`);
            if (closePopupBtn) {
                closePopupBtn.addEventListener('click', closeAndClearPopup);
            }
        }
    }

    /**
     * HTML 이스케이프
     * @param {string} str
     * @returns {string}
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 프롬프트를 편집 폼에 로드
     * 실리태번의 loadPromptIntoEditForm 함수와 동일
     * @param {Object} prompt - 프롬프트 객체
     */
    loadPromptIntoEditForm(prompt) {
        if (!prompt) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20016', '편집 폼 로드: 프롬프트가 null/undefined');
            }
            return;
        }


        const prefix = this.configuration.prefix;
        const nameField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_name`);
        
        // 필드들이 존재하는지 확인
        if (!nameField) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20017', '편집 폼 필드를 찾을 수 없음, 모달 미준비');
            }
        }
        const roleField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_role`);
        const promptField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_prompt`);
        const injectionPositionField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_position`);
        const injectionDepthField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_depth`);
        const injectionOrderField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_order`);
        const injectionTriggerField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
        const depthBlock = document.getElementById(`${prefix}prompt_manager_depth_block`);
        const orderBlock = document.getElementById(`${prefix}prompt_manager_order_block`);
        const forbidOverridesField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_forbid_overrides`);
        const forbidOverridesBlock = document.getElementById(`${prefix}prompt_manager_forbid_overrides_block`);
        const entrySourceBlock = document.getElementById(`${prefix}prompt_manager_popup_entry_source_block`);
        const entrySource = document.getElementById(`${prefix}prompt_manager_popup_entry_source`);
        const resetPromptButton = document.getElementById(`${prefix}prompt_manager_popup_entry_form_reset`);

        if (nameField) nameField.value = prompt.name || '';
        if (roleField) roleField.value = prompt.role || 'system';
        if (promptField) {
            promptField.value = prompt.content || '';
            promptField.disabled = prompt.marker ?? false;
        }
        // injectionPositionField 설정 (disabled 해제 후 값 설정)
        if (injectionPositionField) {
            // 먼저 disabled 해제
            injectionPositionField.removeAttribute('disabled');
            
            // injection_position이 숫자면 그대로, 없으면 기본값 0 (Relative)
            const positionValue = prompt.injection_position ?? INJECTION_POSITION.RELATIVE;
            injectionPositionField.value = String(positionValue);
            
            // 시스템 프롬프트인 경우 다시 disabled 설정
            if (this.systemPrompts.includes(prompt.identifier)) {
                injectionPositionField.setAttribute('disabled', 'disabled');
            }
        }
        if (injectionDepthField) injectionDepthField.value = (prompt.injection_depth ?? DEFAULT_DEPTH).toString();
        if (injectionOrderField) injectionOrderField.value = (prompt.injection_order ?? DEFAULT_ORDER).toString();

        if (injectionTriggerField) {
            // 모든 옵션 선택 해제
            Array.from(injectionTriggerField.options).forEach(option => {
                option.selected = false;
            });
            // 프롬프트의 injection_trigger에 맞는 옵션 선택
            if (Array.isArray(prompt.injection_trigger) && prompt.injection_trigger.length > 0) {
                Array.from(injectionTriggerField.options).forEach(option => {
                    if (prompt.injection_trigger.includes(option.value)) {
                        option.selected = true;
                    }
                });
            }
        }

        // Position에 따라 depth/order 블록 표시 (실리태번처럼 visibility 사용)
        const injectionPosition = prompt.injection_position ?? INJECTION_POSITION.RELATIVE;
        const depthOrderRow = document.getElementById(`${prefix}prompt_manager_depth_order_row`);
        const isAbsolute = injectionPosition === INJECTION_POSITION.ABSOLUTE;
        
        if (depthOrderRow) {
            depthOrderRow.style.display = isAbsolute ? 'flex' : 'none';
        }
        if (depthBlock) {
            depthBlock.style.visibility = isAbsolute ? 'visible' : 'hidden';
            depthBlock.style.display = isAbsolute ? 'flex' : 'none';
        }
        if (orderBlock) {
            orderBlock.style.visibility = isAbsolute ? 'visible' : 'hidden';
            orderBlock.style.display = isAbsolute ? 'flex' : 'none';
        }

        if (forbidOverridesField) forbidOverridesField.checked = prompt.forbid_overrides ?? false;
        if (forbidOverridesBlock) {
            // 실리태번처럼 overridablePrompts에 포함된 프롬프트에만 표시 (main, jailbreak만)
            const shouldShow = this.overridablePrompts.includes(prompt.identifier);
            forbidOverridesBlock.style.display = shouldShow ? 'block' : 'none';
            forbidOverridesBlock.style.visibility = shouldShow ? 'visible' : 'hidden';
        }

        // Source 표시 (TODO: promptSources 구현 필요)
        if (entrySourceBlock) entrySourceBlock.style.display = 'none';
        if (entrySource) entrySource.textContent = '';

        // Reset 버튼 표시 (시스템 프롬프트일 때만)
        if (resetPromptButton) {
            if (prompt.system_prompt) {
                resetPromptButton.style.display = 'block';
                resetPromptButton.dataset.pmPrompt = prompt.identifier;
            } else {
                resetPromptButton.style.display = 'none';
            }
        }

        // Injection position change 이벤트 핸들러 (실리태번처럼 매번 제거 후 재연결)
        if (injectionPositionField) {
            // 기존 이벤트 리스너 제거 (있을 경우)
            const handler = (e) => this.handleInjectionPositionChange(e);
            injectionPositionField.removeEventListener('change', handler);
            // 새 이벤트 리스너 추가
            injectionPositionField.addEventListener('change', handler);
        }

        // Injection position에 따라 depth/order 블록 표시 업데이트
        if (injectionPositionField) {
            const currentPosition = Number(injectionPositionField.value);
            const isAbsolute = currentPosition === INJECTION_POSITION.ABSOLUTE;
            if (depthBlock) {
                depthBlock.style.visibility = isAbsolute ? 'visible' : 'hidden';
                depthBlock.style.display = isAbsolute ? 'block' : 'none';
            }
            if (orderBlock) {
                orderBlock.style.visibility = isAbsolute ? 'visible' : 'hidden';
                orderBlock.style.display = isAbsolute ? 'block' : 'none';
            }
        }

        // Save 버튼에 prompt ID 저장
        const savePromptButton = document.getElementById(`${prefix}prompt_manager_popup_entry_form_save`);
        if (savePromptButton) {
            savePromptButton.dataset.pmPrompt = prompt.identifier;
        }
    }

    /**
     * Injection position 변경 핸들러
     * @param {Event} event
     */
    handleInjectionPositionChange(event) {
        const prefix = this.configuration.prefix;
        const injectionDepthBlock = document.getElementById(`${prefix}prompt_manager_depth_block`);
        const injectionOrderBlock = document.getElementById(`${prefix}prompt_manager_order_block`);
        const injectionPosition = Number(event.target.value);
        
        const isAbsolute = injectionPosition === INJECTION_POSITION.ABSOLUTE;
        const depthOrderRow = document.getElementById(`${prefix}prompt_manager_depth_order_row`);
        
        if (depthOrderRow) {
            depthOrderRow.style.display = isAbsolute ? 'flex' : 'none';
        }
        if (injectionDepthBlock) {
            injectionDepthBlock.style.visibility = isAbsolute ? 'visible' : 'hidden';
            injectionDepthBlock.style.display = isAbsolute ? 'flex' : 'none';
        }
        if (injectionOrderBlock) {
            injectionOrderBlock.style.visibility = isAbsolute ? 'visible' : 'hidden';
            injectionOrderBlock.style.display = isAbsolute ? 'flex' : 'none';
        }
        
        // 위치가 변경되면 depth와 order를 기본값으로 설정
        if (injectionPosition === INJECTION_POSITION.ABSOLUTE) {
            const injectionDepthField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_depth`);
            const injectionOrderField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_order`);
            if (injectionDepthField && !injectionDepthField.value) {
                injectionDepthField.value = DEFAULT_DEPTH.toString();
            }
            if (injectionOrderField && !injectionOrderField.value) {
                injectionOrderField.value = DEFAULT_ORDER.toString();
            }
        }
    }

    /**
     * 편집 폼 클리어
     * 실리태번의 clearEditForm 함수와 동일
     */
    clearEditForm() {
        const prefix = this.configuration.prefix;
        const editArea = document.getElementById(`${prefix}prompt_manager_popup_edit`);
        if (editArea) {
            editArea.style.display = 'none';
        }

        const nameField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_name`);
        const roleField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_role`);
        const promptField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_prompt`);
        const injectionPositionField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_position`);
        const injectionDepthField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_depth`);
        const injectionOrderField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_order`);
        const injectionTriggerField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
        const depthBlock = document.getElementById(`${prefix}prompt_manager_depth_block`);
        const orderBlock = document.getElementById(`${prefix}prompt_manager_order_block`);
        const forbidOverridesField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_forbid_overrides`);
        const forbidOverridesBlock = document.getElementById(`${prefix}prompt_manager_forbid_overrides_block`);
        const entrySourceBlock = document.getElementById(`${prefix}prompt_manager_popup_entry_source_block`);
        const entrySource = document.getElementById(`${prefix}prompt_manager_popup_entry_source`);

        if (nameField) nameField.value = '';
        if (roleField) {
            roleField.selectedIndex = 0;
            roleField.disabled = false;
        }
        if (promptField) {
            promptField.value = '';
            promptField.disabled = false;
        }
        if (injectionPositionField) {
            injectionPositionField.removeAttribute('disabled');
            injectionPositionField.selectedIndex = 0;
            injectionPositionField.value = String(INJECTION_POSITION.RELATIVE);
        }
        if (injectionDepthField) injectionDepthField.value = DEFAULT_DEPTH.toString();
        if (injectionOrderField) injectionOrderField.value = DEFAULT_ORDER.toString();
        if (injectionTriggerField) {
            Array.from(injectionTriggerField.options).forEach(option => {
                option.selected = false;
            });
        }
        if (depthBlock) depthBlock.style.display = 'none';
        if (orderBlock) orderBlock.style.display = 'none';
        if (forbidOverridesField) forbidOverridesField.checked = false;
        if (forbidOverridesBlock) forbidOverridesBlock.style.display = 'none';
        if (entrySourceBlock) entrySourceBlock.style.display = 'none';
        if (entrySource) entrySource.textContent = '';
    }

    /**
     * 검사 폼 클리어
     * 실리태번의 clearInspectForm 함수와 동일
     */
    clearInspectForm() {
        const prefix = this.configuration.prefix;
        const inspectArea = document.getElementById(`${prefix}prompt_manager_popup_inspect`);
        if (inspectArea) {
            inspectArea.style.display = 'none';
        }
        
        const messageList = document.getElementById(`${prefix}prompt_manager_popup_entry_form_inspect_list`);
        if (messageList) {
            messageList.innerHTML = '';
        }
    }

    /**
     * 팝업 표시
     * 실리태번의 showPopup 함수와 동일
     * @param {string} area - 'edit' 또는 'inspect'
     */
    showPopup(area = 'edit') {
        const prefix = this.configuration.prefix;
        const popup = document.getElementById(`${prefix}prompt_manager_popup`);
        if (!popup) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20018', '팝업 요소를 찾을 수 없음');
            }
            return;
        }

        const areaElement = document.getElementById(`${prefix}prompt_manager_popup_${area}`);
        if (areaElement) {
            areaElement.style.display = area === 'edit' ? 'block' : 'flex';
        }

        // 다른 영역 숨기기
        if (area === 'edit') {
            const inspectArea = document.getElementById(`${prefix}prompt_manager_popup_inspect`);
            if (inspectArea) inspectArea.style.display = 'none';
        } else {
            const editArea = document.getElementById(`${prefix}prompt_manager_popup_edit`);
            if (editArea) editArea.style.display = 'none';
        }

        // 팝업 표시 (애니메이션)
        popup.style.display = 'block';
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'translateY(0)';
            
            // DOM이 완전히 렌더링된 후 Select2 초기화
            setTimeout(() => {
                if (area === 'edit' && typeof $ !== 'undefined' && $.fn.select2) {
                    const triggerSelect = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
                    if (triggerSelect && !$(triggerSelect).hasClass('select2-hidden-accessible')) {
                        $(triggerSelect).select2({
                            placeholder: 'All types (default)',
                            width: '100%',
                            closeOnSelect: false,
                        });
                    }
                }
            }, 50);
        });
    }

    /**
     * 팝업 숨기기
     * 실리태번의 hidePopup 함수와 동일
     */
    hidePopup() {
        const prefix = this.configuration.prefix;
        const popup = document.getElementById(`${prefix}prompt_manager_popup`);
        if (!popup) return;

        // Select2 제거 (정리)
        if (typeof $ !== 'undefined' && $.fn.select2) {
            const triggerSelect = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
            if (triggerSelect && $(triggerSelect).hasClass('select2-hidden-accessible')) {
                $(triggerSelect).select2('destroy');
            }
        }

        // 애니메이션
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 200);
    }

    /**
     * 편집 폼에서 프롬프트 업데이트
     * 실리태번의 updatePromptWithPromptEditForm 함수와 동일
     * @param {Object} prompt - 업데이트할 프롬프트 객체
     */
    updatePromptWithPromptEditForm(prompt) {
        const prefix = this.configuration.prefix;
        const nameField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_name`);
        const roleField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_role`);
        const promptField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_prompt`);
        const injectionPositionField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_position`);
        const injectionDepthField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_depth`);
        const injectionOrderField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_order`);
        const injectionTriggerField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_injection_trigger`);
        const forbidOverridesField = document.getElementById(`${prefix}prompt_manager_popup_entry_form_forbid_overrides`);

        // 실리태번처럼 필드 값 직접 할당 (필드가 없으면 기본값 사용)
        prompt.name = nameField?.value.trim() || '';
        prompt.role = roleField?.value || 'system';
        prompt.content = promptField?.value || '';
        prompt.injection_position = injectionPositionField ? Number(injectionPositionField.value) : INJECTION_POSITION.RELATIVE;
        prompt.injection_depth = injectionDepthField ? Number(injectionDepthField.value) : DEFAULT_DEPTH;
        prompt.injection_order = injectionOrderField ? Number(injectionOrderField.value) : DEFAULT_ORDER;
        // Select2가 적용된 경우 jQuery로 값을 가져오고, 아니면 일반 방식 사용
        if (injectionTriggerField) {
            if (typeof $ !== 'undefined' && $.fn.select2 && $(injectionTriggerField).hasClass('select2-hidden-accessible')) {
                const selectedValues = $(injectionTriggerField).val();
                prompt.injection_trigger = Array.isArray(selectedValues) ? selectedValues : (selectedValues ? [selectedValues] : []);
            } else {
                prompt.injection_trigger = Array.from(injectionTriggerField.selectedOptions).map(option => option.value);
            }
        } else {
            prompt.injection_trigger = [];
        }
        prompt.forbid_overrides = forbidOverridesField?.checked || false;
    }

    /**
     * 프롬프트 추가
     * 실리태번의 addPrompt 함수와 동일
     * @param {Object} prompt - 추가할 프롬프트 객체
     * @param {string} [identifier] - 프롬프트 식별자 (선택사항)
     */
    addPrompt(prompt, identifier = null) {
        if (!prompt.identifier && identifier) {
            prompt.identifier = identifier;
        }
        if (!prompt.identifier) {
            prompt.identifier = this.getUuidv4();
        }

        // 이미 존재하는 프롬프트인지 확인
        const existingIndex = this.getPromptIndexById(prompt.identifier);
        const isNewPrompt = existingIndex < 0;
        
        if (existingIndex >= 0) {
            // 업데이트
            this.serviceSettings.prompts[existingIndex] = prompt;
        } else {
            // 새로 추가
            this.serviceSettings.prompts.push(prompt);
        }

        // 새 프롬프트인 경우 prompt_order에도 자동 추가 (실리태번과 동일)
        // system_prompt나 marker가 아닌 사용자 추가 프롬프트만 자동 추가
        if (isNewPrompt && !prompt.system_prompt && !prompt.marker) {
            if ('global' === this.configuration.promptOrder.strategy) {
                const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
                const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);
                
                // 이미 prompt_order에 있는지 확인
                const alreadyExists = promptOrder.some(entry => entry.identifier === prompt.identifier);
                if (!alreadyExists) {
                    promptOrder.push({
                        identifier: prompt.identifier,
                        enabled: true, // 기본값은 활성화
                    });
                    this.addPromptOrderForCharacter(dummyCharacter, promptOrder);
                    this.log(`Auto-added new prompt ${prompt.identifier} to prompt_order`);
                }
            }
        }

        this.log('Added/Updated prompt: ' + prompt.identifier);
    }

    /**
     * 프롬프트를 캐릭터의 순서에 추가
     * 실리태번의 appendPrompt 함수와 동일
     * @param {Object} prompt - 추가할 프롬프트 객체
     * @param {Object} character - 캐릭터 객체
     */
    appendPrompt(prompt, character) {
        if (!character || !prompt) return;

        // 프롬프트가 없으면 추가
        const existingPrompt = this.getPromptById(prompt.identifier);
        if (!existingPrompt) {
            this.addPrompt(prompt);
        }

        // 순서에 추가
        const promptOrder = this.getPromptOrderForCharacter(character);
        const alreadyExists = promptOrder.some(entry => entry.identifier === prompt.identifier);
        
        if (!alreadyExists) {
            promptOrder.push({
                identifier: prompt.identifier,
                enabled: true,
            });
            this.log(`Appended prompt ${prompt.identifier} to character ${character.name || character.id}`);
        }
    }

    /**
     * 프롬프트를 캐릭터의 순서에서 제거 (detach)
     * 실리태번의 detachPrompt 함수와 동일
     * @param {Object} prompt - 제거할 프롬프트 객체
     * @param {Object} character - 캐릭터 객체
     */
    detachPrompt(prompt, character) {
        if (!character || !prompt) return;

        const promptOrder = this.getPromptOrderForCharacter(character);
        const index = promptOrder.findIndex(entry => entry.identifier === prompt.identifier);
        
        if (index >= 0) {
            promptOrder.splice(index, 1);
            this.log(`Detached prompt ${prompt.identifier} from character ${character.name || character.id}`);
        }
    }

    /**
     * 모바일 디바이스인지 확인
     * @returns {boolean}
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }

    /**
     * 프롬프트 리스트를 드래그 가능하게 만들기
     * 실리태번의 makeDraggable 함수와 동일
     */
    makeDraggable() {
        if (typeof $ === 'undefined' || !$.fn.sortable) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20019', 'jQuery UI Sortable을 사용할 수 없음');
            }
            return;
        }

        const listSelector = `#${this.configuration.listIdentifier}`;
        const $list = $(listSelector);

        if (!$list.length) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PROMPT_20020', '리스트 요소를 찾을 수 없음');
            }
            return;
        }

        // 기존 sortable이 있다면 destroy
        if ($list.hasClass('ui-sortable')) {
            $list.sortable('destroy');
        }

        // 실리태번과 완전히 동일하게 구현
        $list.sortable({
            delay: this.configuration.sortableDelay,
            handle: this.isMobile() ? '.drag-handle' : null,
            items: `.${this.configuration.prefix}prompt_manager_prompt_draggable`,
            update: (event, ui) => {
                // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 사용
                const dummyCharacter = { id: this.configuration.promptOrder.dummyId };
                const promptOrder = this.getPromptOrderForCharacter(dummyCharacter);
                const promptListElement = $(listSelector).sortable('toArray', { 
                    attribute: 'data-pm-identifier' 
                });
                
                
                // 기존 프롬프트 순서 정보 유지하면서 순서만 재배열
                const idToObjectMap = new Map(
                    promptOrder.map(prompt => [prompt.identifier, prompt])
                );
                const updatedPromptOrder = promptListElement
                    .map(identifier => idToObjectMap.get(identifier))
                    .filter(entry => entry !== undefined); // undefined 항목 제거


                // 캐릭터와 상관없이 항상 global (dummyId) 프롬프트 순서 업데이트
                this.removePromptOrderForCharacter(dummyCharacter);
                this.addPromptOrderForCharacter(dummyCharacter, updatedPromptOrder);


                // 설정 저장
                if (this.saveServiceSettings) {
                    this.saveServiceSettings().then(() => {
                    }).catch(err => {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PROMPT_8004', '서비스 설정 저장 오류', err);
                        }
                    });
                } else {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_PROMPT_20020', 'saveServiceSettings가 설정되지 않음');
                    }
                }
            },
        });
    }
}

