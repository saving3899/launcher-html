/**
 * PresetManager 클래스
 * Chat Completion Presets 관리
 * 실리태번의 preset-manager.js 구조를 완전히 따름
 */


// 실리태번 구조: openai_settings (배열), openai_setting_names (객체), oai_settings (현재 설정)
let openai_settings = [];
let openai_setting_names = {};
let oai_settings = null;

/**
 * PresetManager 클래스
 * 특정 API의 preset을 관리
 */
class PresetManager {
    /**
     * @param {HTMLElement} select - 드롭다운 select 요소
     * @param {string} apiId - API ID ('openai', 'novel', 등)
     */
    constructor(select, apiId) {
        this.select = select;  // 드롭다운 select 요소
        this.apiId = apiId;   // API ID ('openai', 'novel', 등)
    }

    /**
     * API별 preset 목록 가져오기
     * @param {string} [api] - API ID (생략 시 현재 API)
     * @returns {{presets: Array, preset_names: Object, settings: Object}}
     */
    async getPresetList(api) {
        // If no API specified, use the current API
        if (api === undefined) {
            api = this.apiId;
        }

        let presets = [];
        let preset_names = {};
        let settings = {};

        switch (api) {
            case 'openai':
                presets = openai_settings;
                preset_names = openai_setting_names;
                settings = oai_settings;
                break;
            // TODO: 다른 API 지원 추가 (novel, kobold, textgenerationwebui 등)
            default:
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PRESET_20001', `알 수 없는 API ID: ${api}`);
                }
        }

        return { presets, preset_names, settings };
    }

    /**
     * Preset 목록 동기화 (IndexedDB에서 불러오기)
     * @returns {Promise<void>}
     */
    async syncPresetList() {
        const data = await PresetStorage.loadAll(this.apiId);
        const { presets, preset_names } = data;
        
        if (this.apiId === 'openai') {
            openai_settings = presets || [];
            openai_setting_names = preset_names || {};
        }
        // TODO: 다른 API 지원 추가
    }

    /**
     * Preset 목록 저장 (IndexedDB에 저장)
     * @returns {Promise<void>}
     */
    async savePresetList() {
        const { presets, preset_names } = await this.getPresetList();
        await PresetStorage.saveAll(this.apiId, presets, preset_names);
    }

    /**
     * 현재 설정에서 preset 설정 가져오기
     * @param {string} [name] - Preset 이름 (생략 시 선택된 preset)
     * @returns {Object} Preset 설정 객체
     */
    async getPresetSettings(name) {
        // name이 지정되었으면 해당 preset 가져오기
        if (name && name !== 'gui' && name !== 'Default') {
            const preset = await this.getCompletionPresetByName(name);
            if (preset) {
                return this.filterPresetSettings(preset);
            }
        }
        
        // 선택된 preset이 'gui'이거나 지정되지 않았으면 현재 설정 사용
        const selectedName = name || this.getSelectedPresetName();
        if (selectedName === 'gui' || selectedName === 'Default') {
            // 현재 설정 로드 (SettingsStorage + PromptManager의 최신 prompts/prompt_order)
            const currentSettings = await SettingsStorage.load();
            
            // PromptManager에서 최신 prompts/prompt_order 가져오기 (있으면 우선 사용)
            let finalSettings = { ...currentSettings };
            if (window.promptManagerInstance) {
                const promptManager = window.promptManagerInstance;
                if (promptManager.serviceSettings?.prompts) {
                    finalSettings.prompts = promptManager.serviceSettings.prompts;
                }
                if (promptManager.serviceSettings?.prompt_order) {
                    finalSettings.prompt_order = promptManager.serviceSettings.prompt_order;
                }
            }
            
            return this.filterPresetSettings(finalSettings);
        }
        
        // 선택된 preset 가져오기
        const preset = await this.getCompletionPresetByName(selectedName);
        if (preset) {
            return this.filterPresetSettings(preset);
        }
        
        // preset을 찾을 수 없으면 현재 설정 사용 (SettingsStorage + PromptManager)
        const currentSettings = await SettingsStorage.load();
        
        // PromptManager에서 최신 prompts/prompt_order 가져오기 (있으면 우선 사용)
        let finalSettings = { ...currentSettings };
        if (window.promptManagerInstance) {
            const promptManager = window.promptManagerInstance;
            if (promptManager.serviceSettings?.prompts) {
                finalSettings.prompts = promptManager.serviceSettings.prompts;
            }
            if (promptManager.serviceSettings?.prompt_order) {
                finalSettings.prompt_order = promptManager.serviceSettings.prompt_order;
            }
        }
        
        return this.filterPresetSettings(finalSettings);
    }

    /**
     * Preset에 저장하지 않을 필드 필터링
     * 실리태번의 filteredKeys와 동일한 로직
     * @param {Object} settings - 전체 설정
     * @returns {Object} 필터링된 설정
     */
    filterPresetSettings(settings) {
        const filteredKeys = [
            'api_server',
            'preset',
            'streaming',
            'truncation_length',
            'n',
            'streaming_url',
            'stopping_strings',
            'can_use_tokenization',
            'can_use_streaming',
            'preset_settings_novel',
            'preset_settings',
            'streaming_novel',
            'nai_preamble',
            'model_novel',
            'streaming_kobold',
            'enabled',
            'bind_to_context',
            'seed',
            'legacy_api',
            'mancer_model',
            'togetherai_model',
            'ollama_model',
            'vllm_model',
            'aphrodite_model',
            'server_urls',
            'type',
            'custom_model',
            'bypass_status_check',
            'infermaticai_model',
            'dreamgen_model',
            'openrouter_model',
            'featherless_model',
            'max_tokens_second',
            'openrouter_providers',
            'openrouter_allow_fallbacks',
            'tabby_model',
            'derived',
            'generic_model',
            'include_reasoning',
            'global_banned_tokens',
            'send_banned_tokens',
            'auto_parse',
            'add_to_prompts',
            'auto_expand',
            'show_hidden',
            'max_additions',
        ];

        const filtered = { ...settings };
        
        for (const key of filteredKeys) {
            if (Object.hasOwn(filtered, key)) {
                delete filtered[key];
            }
        }

        return filtered;
    }

    /**
     * Preset 이름으로 preset 찾기
     * @param {string} name - Preset 이름
     * @returns {Object|undefined} Preset 객체
     */
    async getCompletionPresetByName(name) {
        const { presets, preset_names } = await this.getPresetList();
        
        // openai는 preset_names가 객체 { name: index }
        if (!Array.isArray(preset_names) && preset_names[name] !== undefined) {
            const index = preset_names[name];
            return presets[index];
        }
        
        return undefined;
    }

    /**
     * 선택된 preset 이름 가져오기
     * @returns {string}
     */
    getSelectedPresetName() {
        if (!this.select) return 'gui';
        const selectedOption = this.select.options[this.select.selectedIndex];
        if (!selectedOption) return 'gui';
        const name = selectedOption.textContent.trim();
        // 'Default'는 'gui'로 변환 (실리태번과 동일)
        return name === 'Default' ? 'gui' : name;
    }

    /**
     * 선택된 preset 값 가져오기
     * @returns {string|number}
     */
    getSelectedPreset() {
        if (!this.select) return 'gui';
        return this.select.value;
    }

    /**
     * 모든 preset 이름 목록 가져오기
     * @returns {string[]}
     */
    getAllPresets() {
        if (!this.select) return [];
        return Array.from(this.select.querySelectorAll('option'))
            .map(opt => opt.textContent.trim())
            .filter(name => name !== 'Default' && name !== 'gui');
    }

    /**
     * 이름으로 preset 찾기
     * @param {string} name - Preset 이름
     * @returns {string|number|undefined} Preset 값
     */
    findPreset(name) {
        if (!this.select) return undefined;
        const option = Array.from(this.select.querySelectorAll('option'))
            .find(opt => opt.textContent.trim() === name);
        return option ? option.value : undefined;
    }

    /**
     * Preset 선택 및 적용
     * @param {string|number|string} value - Preset 값 또는 이름
     * @returns {Promise<void>}
     */
    async selectPreset(value) {
        if (!this.select) return;
        
        // value 파싱: 문자열이 숫자인지 확인
        let presetIndex = value;
        if (typeof value === 'string') {
            // 'gui'인 경우 그대로 유지
            if (value === 'gui') {
                presetIndex = 'gui';
            } else {
                // 숫자 문자열인지 확인 (인덱스)
                const numValue = parseInt(value, 10);
                if (!isNaN(numValue) && value === numValue.toString()) {
                    // 숫자 문자열이면 인덱스로 사용
                    presetIndex = numValue;
                } else {
                    // 프리셋 이름으로 인덱스 찾기
                    const { preset_names } = await this.getPresetList();
                    presetIndex = preset_names[value];
                    if (presetIndex === undefined) {
                        // 경고 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('WARN_PRESET_20002', `프리셋을 찾을 수 없음 (selectPreset): ${value}`);
                        }
                        return;
                    }
                }
            }
        }
        
        // 실제로 프리셋 이름이 다르면 항상 적용 (값만 같아도 내용이 다를 수 있음)
        // 단, change 이벤트로부터 호출된 경우에만 같은 값이면 스킵 (무한 루프 방지)
        // 하지만 프리셋 내용이 변경되었을 수 있으므로 항상 적용하는 것이 안전
        const shouldSkip = false; // 항상 프리셋 적용 (내용이 변경되었을 수 있음)
        
        if (shouldSkip) {
            return;
        }
        
        // 드롭다운 값 설정 (문자열로 변환)
        // select.value는 문자열이어야 하므로 숫자 인덱스를 문자열로 변환
        if (presetIndex === 'gui') {
            this.select.value = 'gui';
        } else if (presetIndex !== undefined && presetIndex !== null) {
            this.select.value = String(presetIndex);
        }
        
        // Preset 데이터 가져오기 및 적용
        let preset = null;
        if (presetIndex !== 'gui' && presetIndex !== undefined) {
            const { presets } = await this.getPresetList();
            preset = presets[presetIndex];
            
            if (preset) {
                // 설정 적용 (SettingsStorage에 저장)
                await this.applyPresetSettings(preset);
            } else {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_PRESET_20003', `인덱스로 프리셋을 찾을 수 없음: ${presetIndex}`);
                }
            }
        } else {
            // 'gui' 또는 undefined인 경우: Default 프리셋으로 처리
            // 실리태번 방식: 먼저 프리셋 저장소에서 "Default" 프리셋을 찾음
            // 있으면 그 값을 사용, 없으면 기본값 사용
            const { presets, preset_names } = await this.getPresetList();
            let defaultPresetData = null;
            
            // 프리셋 저장소에서 "Default" 프리셋 찾기
            if (!Array.isArray(preset_names) && preset_names['Default'] !== undefined) {
                // openai는 preset_names가 객체 { name: index }
                const index = preset_names['Default'];
                defaultPresetData = presets[index];
            } else if (Array.isArray(preset_names) && preset_names.includes('Default')) {
                // 일부 API는 preset_names가 배열
                const index = preset_names.indexOf('Default');
                defaultPresetData = presets[index];
            }
            
            // 저장소에 Default 프리셋이 없으면 기본값 사용
            if (!defaultPresetData) {
                defaultPresetData = await createDefaultPreset();
            }
            
            // SettingsStorage에서 현재 설정 로드 (API 키 등 프리셋에 저장하지 않는 설정)
            const settings = await SettingsStorage.load();
            
            // 프리셋 데이터를 기반으로 하되, SettingsStorage의 일부 설정만 유지
            // (API 키, 모델 선택 등은 유지)
            preset = {
                ...defaultPresetData,
                // SettingsStorage에서 유지할 설정들만 추가 (프리셋과 무관한 설정)
                apiProvider: settings.apiProvider,
                apiKeys: settings.apiKeys,
                apiModels: settings.apiModels,
                currentCharacterId: settings.currentCharacterId,
                currentChatId: settings.currentChatId,
                name: 'Default',
                // prompts와 prompt_order는 명시적으로 undefined로 설정하여
                // applyPresetSettings 오버라이드에서 기본 프롬프트를 사용하도록 함
                // (단, 프리셋에 prompts/prompt_order가 있으면 사용)
                prompts: defaultPresetData.prompts !== undefined ? defaultPresetData.prompts : undefined,
                prompt_order: defaultPresetData.prompt_order !== undefined ? defaultPresetData.prompt_order : undefined,
            };
            
            await this.applyPresetSettings(preset);
        }
        
        // change 이벤트는 dispatch하지 않음 (이미 change 이벤트로부터 호출되었거나, 무한 루프 방지)
        // 하지만 다른 곳에서 호출된 경우를 위해 플래그 사용
        // this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    /**
     * Preset 설정을 UI와 저장소에 적용
     * @param {Object} preset - Preset 데이터
     * @returns {Promise<void>}
     */
    async applyPresetSettings(preset) {
        
        // Default 프리셋('Default' 또는 'gui')인지 확인
        const isDefaultPreset = (preset.name === 'Default' || preset.name === 'gui') || 
                                (preset.prompts === undefined && preset.prompt_order === undefined);
        
        // SettingsStorage에 preset 설정 저장 (프롬프트 포함)
        const settingsToSave = { ...preset };
        
        // SettingsStorage를 통해 현재 설정 업데이트
        // (이미 SettingsStorage.load()로 가져온 설정에 병합)
        const currentSettings = await SettingsStorage.load();
        
        // prompts와 prompt_order는 별도로 처리 (undefined로 덮어쓰지 않도록)
        const { prompts: currentPrompts, prompt_order: currentPromptOrder, ...restCurrentSettings } = currentSettings;
        const { prompts: presetPrompts, prompt_order: presetPromptOrder, ...restPresetData } = settingsToSave;
        
        // 기본 설정 병합 (prompts/prompt_order 제외)
        // 실리태번 방식: 프리셋에 정의된 필드는 프리셋 값을 사용하고,
        // 프리셋에 없는 필드는 현재 설정에서 유지
        const mergedSettings = {
            ...restCurrentSettings,
            ...restPresetData,
            preset_settings_openai: preset.name || 'Default',
        };
        
        // prompts와 prompt_order 처리
        // Default 프리셋인 경우:
        // - 저장소에 프리셋이 있고 prompts/prompt_order가 있으면 그 값을 사용 (사용자가 저장한 상태)
        // - 저장소에 프리셋이 없거나 prompts/prompt_order가 없으면 기본값 사용 (setupPromptsPanelEvents에서 처리)
        if (isDefaultPreset) {
            if (presetPrompts !== undefined && Array.isArray(presetPrompts) && presetPrompts.length > 0) {
                // 저장소에 Default 프리셋이 있고 prompts가 있으면 사용
                mergedSettings.prompts = presetPrompts;
            } else {
                // 저장소에 prompts가 없으면 삭제하여 setupPromptsPanelEvents에서 기본값으로 설정하도록 함
                delete mergedSettings.prompts;
            }
            
            if (presetPromptOrder !== undefined && Array.isArray(presetPromptOrder) && presetPromptOrder.length > 0) {
                // 저장소에 Default 프리셋이 있고 prompt_order가 있으면 사용
                mergedSettings.prompt_order = presetPromptOrder;
            } else {
                // 저장소에 prompt_order가 없으면 삭제하여 setupPromptsPanelEvents에서 기본값으로 설정하도록 함
                delete mergedSettings.prompt_order;
            }
        } else if (presetPrompts !== undefined && Array.isArray(presetPrompts) && presetPrompts.length > 0) {
            mergedSettings.prompts = presetPrompts;
        } else {
            // prompts가 undefined이거나 배열이 아닌 경우, 현재 설정 유지
            if (currentPrompts !== undefined) {
                mergedSettings.prompts = currentPrompts;
            }
        }
        
        if (!isDefaultPreset) {
            // Default 프리셋이 아닌 경우만 prompt_order 처리
            if (presetPromptOrder !== undefined && Array.isArray(presetPromptOrder) && presetPromptOrder.length > 0) {
                mergedSettings.prompt_order = presetPromptOrder;
            } else {
                // prompt_order가 undefined이거나 배열이 아닌 경우, 현재 설정 유지
                if (currentPromptOrder !== undefined) {
                    mergedSettings.prompt_order = currentPromptOrder;
                }
            }
        }
        
        await SettingsStorage.save(mergedSettings);
        
        // UI 업데이트는 프롬프트 패널의 applyPresetToUI에서 처리됨
        // (manager.applyPresetSettings 오버라이드에서 호출)
    }

    /**
     * Preset 저장
     * @param {string} name - Preset 이름
     * @param {Object} [data] - Preset 데이터 (생략 시 현재 설정 사용)
     * @param {Object} [options] - 옵션
     * @param {boolean} [options.skipUpdate=false] - 목록 업데이트 건너뛰기
     * @param {boolean} [options.skipToast=false] - 토스트 알림 건너뛰기
     * @returns {Promise<void>}
     */
    async savePreset(name, data = null, options = {}) {
        const { skipUpdate = false, skipToast = false } = options;
        
        // Preset 데이터 준비
        const presetData = data || await this.getPresetSettings();
        
        // 이름 추가
        presetData.name = name;

        const { presets, preset_names } = await this.getPresetList();
        
        // 기존 preset 찾기
        const existingIndex = preset_names[name];
        
        if (existingIndex !== undefined) {
            // 기존 preset 업데이트
            presets[existingIndex] = presetData;
        } else {
            // 새 preset 추가
            const newIndex = presets.length;
            presets.push(presetData);
            preset_names[name] = newIndex;
        }
        
        // IndexedDB에 저장
        await PresetStorage.saveAll(this.apiId, presets, preset_names);
        
        // 동기화
        if (this.apiId === 'openai') {
            openai_settings = presets;
            openai_setting_names = preset_names;
        }
        
        // 토스트 알림 표시 (skipToast가 false인 경우에만)
        if (!skipToast) {
            showToast(`프리셋 "${name}"이(가) 저장되었습니다.`, 'success');
        }
        
        if (!skipUpdate) {
            // 드롭다운 업데이트
            await this.populatePresetSelect();
        }
    }

    /**
     * 현재 선택된 preset 업데이트
     * @returns {Promise<void>}
     */
    async updatePreset() {
        const selectedName = this.getSelectedPresetName();
        
        if (selectedName === 'gui' || selectedName === 'Default') {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PRESET_20004', 'GUI/Default 프리셋은 업데이트할 수 없음');
            }
            return;
        }

        // updatePreset 호출 시에는 항상 현재 SettingsStorage의 최신 값을 사용
        // (getPresetSettings()가 저장소의 기존 프리셋을 가져오는 것을 방지)
        const currentSettings = await SettingsStorage.load();
        
        // PromptManager에서 최신 prompts/prompt_order 가져오기
        let finalSettings = { ...currentSettings };
        if (window.promptManagerInstance) {
            const promptManager = window.promptManagerInstance;
            if (promptManager.serviceSettings?.prompts) {
                finalSettings.prompts = promptManager.serviceSettings.prompts;
            }
            if (promptManager.serviceSettings?.prompt_order) {
                finalSettings.prompt_order = promptManager.serviceSettings.prompt_order;
            }
        }
        
        // 필터링하여 프리셋 저장 (토스트는 updatePreset에서 표시하므로 skipToast: true)
        const presetData = this.filterPresetSettings(finalSettings);
        presetData.name = selectedName;
        
        await this.savePreset(selectedName, presetData, { skipToast: true });
        
        // 토스트 알림 표시
        showToast(`프리셋 "${selectedName}"이(가) 업데이트되었습니다.`, 'success');
    }

    /**
     * 새 이름으로 preset 저장 (Save as)
     * @returns {Promise<string|undefined>} 새 preset 이름
     */
    async savePresetAs() {
        const inputValue = this.getSelectedPresetName();
        
        const name = await showInputModal('Preset name:', 'Preset Name', inputValue);
        
        if (!name || name.trim() === '') {
            return undefined;
        }
        
        await this.savePreset(name.trim());
        return name.trim();
    }

    /**
     * Preset 이름 변경
     * @param {string} newName - 새 이름
     * @returns {Promise<void>}
     */
    async renamePreset(newName) {
        const oldName = this.getSelectedPresetName();
        
        if (oldName.toLowerCase().trim() === newName.toLowerCase().trim()) {
            throw new Error('New name must be different from old name');
        }
        
        // 새 이름으로 저장
        const preset = await this.getCompletionPresetByName(oldName);
        if (!preset) {
            throw new Error(`Preset "${oldName}" not found`);
        }
        
        await this.savePreset(newName, preset);
        
        // 기존 preset 삭제
        await this.deletePreset(oldName);
        
        // 선택 변경
        const newIndex = (await this.getPresetList()).preset_names[newName];
        if (this.select) {
            this.select.value = newIndex;
        }
    }

    /**
     * Preset 삭제
     * @param {string} [name] - Preset 이름 (생략 시 선택된 preset)
     * @returns {Promise<boolean>}
     */
    async deletePreset(name) {
        const nameToDelete = name || this.getSelectedPresetName();
        
        if (nameToDelete === 'gui' || nameToDelete === 'Default') {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_PRESET_20005', 'GUI/Default 프리셋은 삭제할 수 없음');
            }
            return false;
        }
        
        const { presets, preset_names } = await this.getPresetList();
        const index = preset_names[nameToDelete];
        
        if (index === undefined) {
            return false;
        }
        
        // 배열에서 제거
        presets.splice(index, 1);
        
        // 이름 맵에서 제거 및 재인덱싱
        delete preset_names[nameToDelete];
        
        // 인덱스 재조정
        const newPresetNames = {};
        Object.keys(preset_names).forEach(presetName => {
            const oldIndex = preset_names[presetName];
            if (oldIndex > index) {
                newPresetNames[presetName] = oldIndex - 1;
            } else if (oldIndex < index) {
                newPresetNames[presetName] = oldIndex;
            }
        });
        
        // IndexedDB에 저장
        await PresetStorage.saveAll(this.apiId, presets, newPresetNames);
        
        // 동기화
        if (this.apiId === 'openai') {
            openai_settings = presets;
            openai_setting_names = newPresetNames;
        }
        
        // 드롭다운 업데이트
        await this.populatePresetSelect();
        
        // 다른 preset 선택 (삭제된 preset이 선택되어 있었다면)
        if (!name || this.getSelectedPresetName() === nameToDelete) {
            if (Object.keys(newPresetNames).length > 0) {
                const nextPresetName = Object.keys(newPresetNames)[0];
                const newValue = newPresetNames[nextPresetName];
                this.selectPreset(newValue);
            }
        }
        
        return true;
    }

    /**
     * Preset 내보내기 (실리태번 파일 구조)
     * @param {string} [name] - Preset 이름 (생략 시 선택된 preset)
     * @returns {Promise<void>}
     */
    async exportPreset(name) {
        const presetName = name || this.getSelectedPresetName();
        
        if (presetName === 'gui' || presetName === 'Default') {
            showToast('Cannot export GUI/Default preset', 'warning');
            return;
        }
        
        // 실리태번 방식: getPresetSettings 사용
        const preset = await this.getPresetSettings(presetName);
        
        if (!preset) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_PRESET_9001', `프리셋을 찾을 수 없습니다: ${presetName}`);
            } else if (typeof showToast === 'function') {
                showToast(`Preset "${presetName}" not found`, 'error');
            }
            return;
        }
        
        // 실리태번 형식: JSON 문자열 (4칸 들여쓰기)
        const data = JSON.stringify(preset, null, 4);
        
        // 파일 다운로드
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${presetName}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Preset 가져오기 (실리태번 파일 구조)
     * @param {File} file - 파일 객체
     * @returns {Promise<void>}
     */
    async importPreset(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const text = e.target.result;
                    const data = JSON.parse(text);
                    
                    // 파일명에서 확장자 제거하여 이름 추출 (실리태번과 동일)
                    // 마지막 확장자만 제거 (.json, .settings 등)
                    const fileName = file.name.replace(/\.[^/.]+$/, '');
                    const name = data?.name ?? fileName;
                    
                    // name 필드 설정 (실리태번과 동일)
                    if (!data.name) {
                        data.name = name;
                    }
                    
                    // 같은 이름의 프리셋이 이미 있으면 이름에 번호 추가
                    const { preset_names } = await this.getPresetList();
                    let finalName = name;
                    let counter = 1;
                    while (preset_names[finalName] !== undefined) {
                        finalName = `${name} (${counter})`;
                        counter++;
                    }
                    
                    // 프리셋 이름 업데이트
                    data.name = finalName;
                    
                    // Preset 저장
                    await this.savePreset(finalName, data);
                    
                    // Preset 목록 업데이트 (이미 savePreset에서 호출되지만 확실히 하기 위해)
                    await this.populatePresetSelect();
                    
                    // 가져온 preset 선택 및 적용 (중요!)
                    // selectPreset은 이름으로도 작동하지만, 인덱스가 더 확실함
                    const { preset_names: updatedPresetNames } = await this.getPresetList();
                    const presetIndex = updatedPresetNames[finalName];
                    if (presetIndex !== undefined) {
                        await this.selectPreset(presetIndex);
                    } else {
                        // 인덱스를 찾을 수 없으면 이름으로 시도
                        await this.selectPreset(finalName);
                    }
                    
                    resolve();
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_PRESET_9002', '프리셋 불러오기 실패', error);
                    } else if (typeof showToast === 'function') {
                        showToast('Failed to import preset. Check console for details.', 'error');
                    }
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                const error = new Error('Failed to read file');
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_PRESET_9003', '파일 읽기 실패', error);
                } else if (typeof showToast === 'function') {
                    showToast('Failed to read file', 'error');
                }
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * 드롭다운에 preset 목록 채우기
     * @returns {Promise<void>}
     */
    async populatePresetSelect() {
        if (!this.select) return;
        
        // SettingsStorage에서 마지막 선택된 프리셋 이름 가져오기 (모달 재오픈 시 복원을 위해)
        const settings = await SettingsStorage.load();
        const lastSelectedPresetName = settings.preset_settings_openai || 'Default';
        
        // 현재 선택된 프리셋 이름도 확인 (현재 값이 있으면 우선 사용)
        const currentlySelectedName = this.getSelectedPresetName();
        const restoreName = currentlySelectedName && currentlySelectedName !== 'gui' && currentlySelectedName !== 'Default' 
            ? currentlySelectedName 
            : (lastSelectedPresetName !== 'Default' && lastSelectedPresetName !== 'gui' ? lastSelectedPresetName : null);
        
        await this.syncPresetList();
        const { presets, preset_names } = await this.getPresetList();
        
        // 기존 옵션 제거 (Default 제외)
        const defaultOption = this.select.querySelector('option[value="gui"]') || 
                             this.select.querySelector('option:first-child');
        this.select.innerHTML = '';
        
        if (defaultOption) {
            this.select.appendChild(defaultOption);
        } else {
            // Default 옵션 추가
            const option = document.createElement('option');
            option.value = 'gui';
            option.textContent = 'Default';
            this.select.appendChild(option);
        }
        
        // Preset 목록 추가
        Object.keys(preset_names).sort().forEach(name => {
            const index = preset_names[name];
            const option = document.createElement('option');
            // option.value는 문자열이어야 함
            option.value = String(index);
            option.textContent = name;
            this.select.appendChild(option);
        });
        
        // 마지막 선택된 프리셋 복원 (change 이벤트 트리거하지 않음)
        if (restoreName && preset_names[restoreName] !== undefined) {
            const restoredIndex = preset_names[restoreName];
            const optionIndex = Array.from(this.select.options).findIndex(opt => opt.value === String(restoredIndex));
            if (optionIndex >= 0) {
                this.select.selectedIndex = optionIndex;
            }
        } else {
            // Default는 항상 첫 번째 옵션
            if (this.select.options.length > 0) {
                this.select.selectedIndex = 0;
            }
        }
    }
}

/**
 * PresetManager 인스턴스 관리
 */
const presetManagers = {};

/**
 * PresetManager 가져오기
 * @param {string} [apiId=''] - API ID (생략 시 현재 API)
 * @returns {PresetManager|null}
 */
function getPresetManager(apiId = '') {
    // TODO: main_api 변수에서 현재 API 가져오기
    if (!apiId) {
        apiId = 'openai'; // 기본값 (나중에 설정에서 가져오기)
    }
    
    if (!presetManagers[apiId]) {
        return null;
    }
    
    return presetManagers[apiId];
}

/**
 * PresetManager 등록
 * @param {HTMLElement} select - 드롭다운 select 요소
 * @param {string} apiId - API ID
 * @returns {PresetManager}
 */
function registerPresetManager(select, apiId) {
    const manager = new PresetManager(select, apiId);
    presetManagers[apiId] = manager;
    
    // select change 이벤트 리스너 추가 (사용자가 직접 드롭다운에서 선택할 때)
    // 플래그를 사용하여 selectPreset 내부에서 발생한 change 이벤트를 무시
    let isSelectPresetInProgress = false;
    select.addEventListener('change', async (e) => {
        // selectPreset 내부에서 발생한 change 이벤트는 무시
        if (isSelectPresetInProgress) {
            return;
        }
        
        const value = e.target.value;
        
        // selectPreset 호출 (value는 문자열 "0", "1", 또는 "gui"일 것)
        isSelectPresetInProgress = true;
        try {
            await manager.selectPreset(value);
        } finally {
            isSelectPresetInProgress = false;
        }
    });
    
    // 초기화: preset 목록 불러오기 및 드롭다운 채우기
    manager.syncPresetList().then(() => {
        manager.populatePresetSelect();
    });
    
    return manager;
}

/**
 * OpenAI 설정 초기화
 * @param {Object} settings - 현재 설정
 * @returns {Promise<void>}
 */
async function initOpenAISettings(settings) {
    // oai_settings 초기화 (현재 설정)
    oai_settings = settings || await SettingsStorage.load();
    
    // Preset 목록 불러오기
    const presetData = await PresetStorage.loadAll('openai');
    openai_settings = presetData.presets || [];
    openai_setting_names = presetData.preset_names || {};
    
    // Default preset이 없으면 생성
    if (openai_settings.length === 0) {
        const defaultPreset = await createDefaultPreset();
        openai_settings.push(defaultPreset);
        openai_setting_names['Default'] = 0;
        await PresetStorage.saveAll('openai', openai_settings, openai_setting_names);
    }
}

/**
 * 기본 preset 생성 (실리태번 Default.json 구조)
 * @returns {Promise<Object>}
 */
async function createDefaultPreset() {
    // 실리태번 Default.json 구조
    return {
        chat_completion_source: 'openai',
        openai_model: 'gpt-4o',
        claude_model: 'claude-3-5-sonnet-20241022',
        openrouter_model: 'OR_Website',
        openrouter_use_fallback: false,
        openrouter_group_models: false,
        openrouter_sort_models: 'alphabetically',
        ai21_model: 'jamba-large',
        mistralai_model: 'mistral-large-2411',
        electronhub_model: 'gpt-4o-mini',
        electronhub_sort_models: 'alphabetically',
        electronhub_group_models: false,
        custom_model: '',
        custom_url: '',
        custom_include_body: '',
        custom_exclude_body: '',
        custom_include_headers: '',
        google_model: 'gemini-2.5-flash',
        vertexai_model: 'gemini-2.5-flash',
        temperature: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_p: 1,
        top_k: 0,
        top_a: 0,
        min_p: 0,
        repetition_penalty: 1,
        openai_max_context: 4095,
        openai_max_tokens: 300,
        wrap_in_quotes: false,
        names_behavior: 0,
        send_if_empty: '',
        impersonation_prompt: '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]',
        new_chat_prompt: '[Start a new Chat]',
        new_group_chat_prompt: '[Start a new group chat. Group members: {{group}}]',
        new_example_chat_prompt: '[Example Chat]',
        continue_nudge_prompt: '[Continue your last message without repeating its original content.]',
        bias_preset_selected: 'Default (none)',
        reverse_proxy: '',
        proxy_password: '',
        max_context_unlocked: false,
        wi_format: '{0}',
        scenario_format: '{{scenario}}',
        personality_format: '{{personality}}',
        group_nudge_prompt: '[Write the next reply only as {{char}}.]',
        stream_openai: true,
        prompts: [
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
        ],
        prompt_order: [
            {
                character_id: 100000,
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
        ],
        show_external_models: false,
        assistant_prefill: '',
        assistant_impersonation: '',
        claude_use_sysprompt: false,
        squash_system_messages: false,
        image_inlining: false,
        bypass_status_check: false,
        continue_prefill: false,
        continue_postfix: ' ',
        seed: -1,
        n: 1
    };
}

/**
 * OpenAI 설정 가져오기 (다른 모듈에서 사용)
 */
function getOpenAISettings() {
    return {
        openai_settings,
        openai_setting_names,
        oai_settings
    };
}

/**
 * OpenAI 설정 설정 (다른 모듈에서 사용)
 */
function setOpenAISettings(presets, presetNames, currentSettings) {
    openai_settings = presets || [];
    openai_setting_names = presetNames || {};
    oai_settings = currentSettings || null;
}

