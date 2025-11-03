/**
 * 메인 애플리케이션
 * 모든 모듈을 통합하여 앱을 초기화하고 관리
 */

// 모든 모듈은 전역 스코프에 로드됩니다 (index.html에서 순차 로드)

// 앱 초기화
class MobileChatApp {
    constructor() {
        this.isCharacterSelected = false; // 캐릭터 선택 상태 플래그
        this.init();
    }

    async init() {
        // DOM 요소 참조
        this.elements = {
            menuBtn: document.getElementById('menu-toggle'),
            closeMenuBtn: document.getElementById('close-menu'),
            sideMenu: document.getElementById('side-menu'),
            settingsToggleBtn: document.getElementById('settings-toggle'),
            closeSettingsBtn: document.getElementById('close-settings'),
            settingsModal: document.getElementById('settings-modal'),
            overlay: document.getElementById('overlay'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            chatMessages: document.getElementById('chat-messages'),
            charName: document.getElementById('char-name'),
            charInfo: document.getElementById('char-info'),
            homeInfo: document.getElementById('home-info'),
            charInfoChatList: document.getElementById('char-info-chat-list'),
            charInfoProfile: document.getElementById('char-info-profile'),
            quickReplyContainer: document.getElementById('quick-reply-container'),
            plusBtn: document.getElementById('plus-btn'),
            plusMenu: document.getElementById('plus-menu'),
            plusMenuNewChat: document.getElementById('plus-menu-new-chat'),
            plusMenuChatList: document.getElementById('plus-menu-chat-list'),
            plusMenuProfile: document.getElementById('plus-menu-profile'),
            plusMenuExitChat: document.getElementById('plus-menu-exit-chat'),
            homeBtn: document.getElementById('home-btn'),
        };

        // 데이터 저장소 초기화 (IndexedDB 사용, 폴더 선택 없음)
        try {
            await initializeDataFolder();
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_INIT_1001', '데이터 저장소 초기화 실패', error);
            }
        }

        // 모듈 초기화 (동기 함수이므로 chatManager, characterManager가 생성됨)
        this.initializeModules();
        
        // 디버깅 정보 확인 (페이지 로드 시)
        this.checkChatLoadDebugInfo();
        
        // 모듈 초기화 후에 iframe 메시지 리스너 설정 (chatManager, characterManager가 준비된 상태)
        this.setupIframeMessageListener();

        // HOME 정보 클릭 이벤트 (캐릭터 관리 모달 열기)
        if (this.elements.homeInfo) {
            this.elements.homeInfo.addEventListener('click', () => {
                this.characterManager.openCharactersPanel();
            });
        }

        // char-info 버튼 클릭 이벤트
        // 채팅 목록 버튼
        if (this.elements.charInfoChatList) {
            this.elements.charInfoChatList.addEventListener('click', () => {
                this.characterManager.openChatListPanel();
            });
        }

        // 캐릭터 프로필 버튼
        if (this.elements.charInfoProfile) {
            this.elements.charInfoProfile.addEventListener('click', async () => {
                const currentCharId = await this.characterManager.getCurrentCharacterId();
                if (!currentCharId) {
                    showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                    return;
                }
                await this.characterManager.openCharacterProfile(currentCharId);
            });
        }

        // 설정 버튼 클릭 이벤트
        if (this.elements.settingsToggleBtn) {
            this.elements.settingsToggleBtn.addEventListener('click', () => {
                this.settingsManager.openSettingsModal();
            });
        }

        // 플러스 버튼 클릭 이벤트 - 메뉴 토글
        if (this.elements.plusBtn) {
            this.elements.plusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.elements.plusMenu) {
                    this.elements.plusMenu.classList.toggle('hidden');
                }
            });
        }

        // 메뉴 외부 클릭 시 메뉴 닫기
        document.addEventListener('click', (e) => {
            if (this.elements.plusMenu && this.elements.plusBtn) {
                if (!this.elements.plusMenu.contains(e.target) && 
                    !this.elements.plusBtn.contains(e.target) &&
                    !this.elements.plusMenu.classList.contains('hidden')) {
                    this.elements.plusMenu.classList.add('hidden');
                }
            }
        });

        // 새 채팅 메뉴 아이템 클릭 이벤트
        if (this.elements.plusMenuNewChat) {
            this.elements.plusMenuNewChat.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (this.elements.plusMenu) {
                    this.elements.plusMenu.classList.add('hidden');
                }
                
                const currentCharId = await this.characterManager.getCurrentCharacterId();
                if (!currentCharId || typeof currentCharId !== 'string' || currentCharId.trim() === '') {
                    showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                    return;
                }
                
                // 실제 캐릭터 존재 여부 확인 (전역 스코프에서 사용)
                const character = await CharacterStorage.load(currentCharId);
                if (!character) {
                    showToast('캐릭터를 찾을 수 없습니다. 먼저 캐릭터를 선택해주세요.', 'error');
                    return;
                }
                
                // 새 채팅 생성 전에 현재 채팅 저장 (덮어쓰기 방지)
                if (this.chatManager.currentChatId && this.chatManager.elements?.chatMessages?.children?.length > 0) {
                    try {
                        await this.chatManager.saveChat();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_INIT_1002', '새 채팅 생성 전 채팅 저장 중 오류가 발생했습니다', error);
                        }
                    }
                }
                
                await this.chatManager.createNewChat(currentCharId);
            });
        }

        // 채팅 목록 메뉴 아이템 클릭 이벤트
        if (this.elements.plusMenuChatList) {
            this.elements.plusMenuChatList.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.elements.plusMenu) {
                    this.elements.plusMenu.classList.add('hidden');
                }
                this.characterManager.openChatListPanel();
            });
        }

        // 캐릭터 프로필 메뉴 아이템 클릭 이벤트
        if (this.elements.plusMenuProfile) {
            this.elements.plusMenuProfile.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (this.elements.plusMenu) {
                    this.elements.plusMenu.classList.add('hidden');
                }
                
                const currentCharId = await this.characterManager.getCurrentCharacterId();
                if (!currentCharId || typeof currentCharId !== 'string' || currentCharId.trim() === '') {
                    showToast('먼저 캐릭터를 선택해주세요.', 'warning');
                    return;
                }
                
                // 실제 캐릭터 존재 여부 확인
                const character = await CharacterStorage.load(currentCharId);
                if (!character) {
                    showToast('캐릭터를 찾을 수 없습니다. 먼저 캐릭터를 선택해주세요.', 'error');
                    return;
                }
                
                await this.characterManager.openCharacterProfile(currentCharId);
            });
        }

        // 홈 버튼 클릭 이벤트 (채팅 나가기)
        if (this.elements.homeBtn) {
            this.elements.homeBtn.addEventListener('click', async () => {
                await this.exitToHomeScreen();
            });
        }

        // 채팅 나가기 메뉴 아이템 클릭 이벤트
        if (this.elements.plusMenuExitChat) {
            this.elements.plusMenuExitChat.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (this.elements.plusMenu) {
                    this.elements.plusMenu.classList.add('hidden');
                }
                
                // 홈화면 상태로 전환
                await this.exitToHomeScreen();
            });
        }

        // 텍스트 입력창 자동 높이 조절
        const messageInput = this.elements.messageInput;
        if (messageInput) {
            // 초기 높이 설정
            messageInput.style.height = '44px';
            
            const adjustHeight = function() {
                // 빈 내용이면 44px로 고정
                const value = this.value || '';
                if (value.trim() === '') {
                    this.style.height = '44px';
                    return;
                }
                
                // overflow를 hidden으로 변경하여 정확한 scrollHeight 측정
                const originalOverflow = this.style.overflow;
                this.style.overflow = 'hidden';
                this.style.height = 'auto';
                
                // 줄바꿈이 없는 한 줄인지 확인
                const hasNewline = value.includes('\n');
                let scrollHeight = this.scrollHeight;
                
                // 한 줄이고 scrollHeight가 44px보다 크면 44px로 조정
                if (!hasNewline && scrollHeight > 44) {
                    scrollHeight = 44;
                }
                
                this.style.overflow = originalOverflow || '';
                
                const minHeight = 44;
                const maxHeight = window.innerHeight * 0.4; // 40vh
                const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
                this.style.height = newHeight + 'px';
            };
            
            messageInput.addEventListener('input', adjustHeight);
            // 포커스를 잃었을 때도 높이 재조정
            messageInput.addEventListener('blur', adjustHeight);
        }
        
        // 초기화 시 플래그는 false로 유지 (UI에 "캐릭터 선택"이 표시되어 있으므로)
        // checkStoredCharacter()는 호출하지 않음 - UI 상태가 진실의 원천
        
        // 초기 상태에 맞게 홈화면 표시 상태 업데이트
        this.updateHomeScreenVisibility();
        
        // setupIframeMessageListener는 initializeModules() 직후에 호출되도록 이미 이동됨
        // (chatManager와 characterManager가 초기화된 후에 리스너를 등록해야 함)
    }
    
    /**
     * 채팅 로드 디버깅 정보 확인
     */
    checkChatLoadDebugInfo() {
        try {
            const debugInfo = JSON.parse(localStorage.getItem('chatLoadDebug') || '[]');
            if (debugInfo.length > 0) {
                // 최신 정보가 새 채팅 생성인 경우 경고
                const latest = debugInfo[debugInfo.length - 1];
                if (latest && latest.type === 'creatingNewChat') {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_APP_20001', '최근에 새 채팅이 생성되었습니다');
                    }
                }
                if (latest && latest.type === 'noChatsFound') {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_APP_20002', '최근에 채팅을 찾지 못했습니다');
                    }
                }
            }
        } catch (e) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_INIT_1003', '디버깅 정보 확인 실패', e);
            }
        }
    }
    
    /**
     * iframe에서 오는 postMessage 리스너 설정
     * triggerSlash 함수로부터 오는 슬래시 명령어 처리
     */
    setupIframeMessageListener() {
        window.addEventListener('message', async (event) => {
            // 보안: origin 체크는 선택사항 (iframe은 same-origin이거나 신뢰할 수 있는 origin)
            // iframe은 srcdoc으로 생성되므로 same-origin이므로 체크 생략 가능
            
            // executeSlashCommand 타입의 메시지만 처리
            if (event.data && event.data.type === 'executeSlashCommand') {
                const command = event.data.command || '';
                
                if (!command || typeof command !== 'string') {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_APP_20003', 'iframe에서 유효하지 않은 슬래시 명령어가 전달되었습니다');
                    }
                    return;
                }
                
                // chatManager와 characterManager가 초기화되었는지 확인
                if (!this.chatManager || !this.characterManager) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_APP_20004', 'chatManager 또는 characterManager가 아직 초기화되지 않았습니다');
                    }
                    return;
                }
                
                // 응답 생성 중이면 슬래시 명령어 실행 차단
                if (this.chatManager.isGenerating) {
                    return;
                }
                
                // 슬래시 명령어 체인 실행 (전역 스코프에서 사용)
                try {
                    await executeSlashCommands(command, this.chatManager, this.characterManager);
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_SLASH_14001', '슬래시 명령어 실행 중 오류가 발생했습니다', error);
                    }
                }
            }
        });
    }
    
    /**
     * 저장된 캐릭터 ID 확인 (상태 플래그만 설정, UI는 업데이트 안 함)
     */
    /**
     * 홈화면으로 나가기 (채팅 종료)
     */
    async exitToHomeScreen() {
        // 응답 생성 중이면 중단
        if (this.chatManager.isGenerating && this.chatManager.abortController) {
            await this.chatManager.abortGeneration();
        }
        
        // 현재 채팅 저장 (홈화면으로 나가기 전)
        if (this.chatManager.currentChatId && this.chatManager.elements?.chatMessages?.children?.length > 0) {
            try {
                await this.chatManager.saveChat();
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_INIT_1004', '홈화면 이동 시 채팅 저장 중 오류가 발생했습니다', error);
                }
            }
        }
        
        // 채팅 초기화
        this.chatManager.clearChat();
        
        // 캐릭터 선택 해제 (전역 스코프에서 사용)
        await CharacterStorage.clearCurrent();
        
        // 상태 플래그 업데이트
        this.isCharacterSelected = false;
        
        // UI 업데이트
        if (this.elements.charName) {
            this.elements.charName.textContent = '캐릭터를 선택하세요';
        }
        
        // 입력창 숨김
        const chatInputContainer = document.querySelector('.chat-input-container');
        if (chatInputContainer) {
            chatInputContainer.classList.remove('visible');
        }
        
        // 홈화면/채팅 영역 표시 상태 업데이트
        this.updateHomeScreenVisibility();
    }

    /**
     * 홈화면/채팅 영역 표시 상태 업데이트
     */
    updateHomeScreenVisibility() {
        const homeScreen = document.getElementById('home-screen');
        const chatContainer = document.getElementById('chat-container');
        const panelContainer = document.getElementById('panel-container');
        const topBar = document.querySelector('.top-bar');
        
        if (this.isCharacterSelected) {
            // 캐릭터 선택됨: 홈화면 숨김, 채팅 영역 및 패널 표시
            if (homeScreen) {
                homeScreen.classList.add('hidden');
            }
            if (chatContainer) {
                chatContainer.classList.remove('hidden');
            }
            if (panelContainer) {
                // 패널이 열려있으면 그대로 유지, 숨김 상태는 유지
                // (panel-container는 패널이 열릴 때만 표시되므로 hidden 클래스 제거는 필요 없음)
            }
            if (topBar) {
                topBar.classList.remove('home-screen-mode');
            }
        } else {
            // 홈화면 상태: 홈화면 표시, 채팅 영역 및 패널 숨김
            if (homeScreen) {
                homeScreen.classList.remove('hidden');
            }
            if (chatContainer) {
                chatContainer.classList.add('hidden');
            }
            if (panelContainer) {
                panelContainer.classList.add('hidden');
            }
            if (topBar) {
                topBar.classList.add('home-screen-mode');
            }
        }

        // 캐릭터 정보 영역 표시/숨김 업데이트 (별도로 분리)
        this.updateCharacterInfoVisibility();
    }

    /**
     * 캐릭터 정보 영역 표시/숨김 업데이트
     * (캐릭터 선택 상태와 홈화면 상태에 따라 char-info와 home-info를 전환)
     */
    updateCharacterInfoVisibility() {
        if (this.isCharacterSelected) {
            // 캐릭터 선택됨: char-info 표시, home-info 숨김
            if (this.elements.charInfo) {
                this.elements.charInfo.style.display = '';
            }
            if (this.elements.homeInfo) {
                this.elements.homeInfo.style.display = 'none';
            }
        } else {
            // 홈화면 상태: char-info 숨김, home-info 표시
            if (this.elements.charInfo) {
                this.elements.charInfo.style.display = 'none';
            }
            if (this.elements.homeInfo) {
                this.elements.homeInfo.style.display = '';
            }
        }
    }

    async checkStoredCharacter() {
        const currentCharId = await this.characterManager.getCurrentCharacterId();
        const chatInputContainer = document.querySelector('.chat-input-container');
        
        if (currentCharId) {
            // 캐릭터가 실제로 존재하는지 확인
            const character = await CharacterStorage.load(currentCharId);
            if (character) {
                // 캐릭터가 존재하면 선택 상태로 설정 (UI는 업데이트 안 함)
                this.isCharacterSelected = true;
                // 입력창 표시
                if (chatInputContainer) {
                    chatInputContainer.classList.add('visible');
                }
            } else {
                // 캐릭터가 없으면 선택 해제
                await CharacterStorage.clearCurrent();
                this.isCharacterSelected = false;
                // 입력창 숨김
                if (chatInputContainer) {
                    chatInputContainer.classList.remove('visible');
                }
            }
        } else {
            this.isCharacterSelected = false;
            // 입력창 숨김
            if (chatInputContainer) {
                chatInputContainer.classList.remove('visible');
            }
        }
        
        // 홈화면/채팅 영역 표시 상태 업데이트
        this.updateHomeScreenVisibility();
    }
    
    /**
     * 저장된 캐릭터 ID가 유효한지 검증
     */
    async validateStoredCharacter() {
        const currentCharId = await this.characterManager.getCurrentCharacterId();
        
        if (currentCharId) {
            // 캐릭터가 실제로 존재하는지 확인
            const character = await CharacterStorage.load(currentCharId);
            const chatInputContainer = document.querySelector('.chat-input-container');
            
            if (character) {
                const name = character?.data?.name || character?.name || currentCharId;
                this.elements.charName.textContent = name;
                // 입력창 표시
                if (chatInputContainer) {
                    chatInputContainer.classList.add('visible');
                }
                this.isCharacterSelected = true;
            } else {
                // 캐릭터가 없으면 선택 해제 및 UI 초기화
                await CharacterStorage.clearCurrent();
                this.elements.charName.textContent = '캐릭터 선택';
                // 입력창 숨김
                const chatInputContainer = document.querySelector('.chat-input-container');
                if (chatInputContainer) {
                    chatInputContainer.classList.remove('visible');
                }
                this.isCharacterSelected = false;
            }
        } else {
            // 캐릭터가 없으면 UI 초기화
            this.elements.charName.textContent = '캐릭터 선택';
            // 입력창 숨김
            const chatInputContainer = document.querySelector('.chat-input-container');
            if (chatInputContainer) {
                chatInputContainer.classList.remove('visible');
            }
            this.isCharacterSelected = false;
        }
        
        // 홈화면/채팅 영역 표시 상태 업데이트
        this.updateHomeScreenVisibility();
    }

    /**
     * 모듈 초기화
     */
    initializeModules() {
        // 1. 채팅 관리자 먼저 생성 (다른 모듈에서 사용)
        this.chatManager = new ChatManager(this.elements);

        // 2. 설정 관리자
        this.settingsManager = new SettingsManager(this.elements);

        // 3. 메뉴 관리자
        this.menuManager = new MenuManager(this.elements);
        this.menuManager.onMenuClick = (menu) => this.handleMenuClick(menu);

        // 4. 파일 관리자 (콜백은 나중에 설정)
        this.fileManager = new FileManager({});

        // 5. 캐릭터 관리자 먼저 생성 (패널 관리자 없이 임시 생성)
        this.characterManager = new CharacterManager(this.elements, null);
        this.characterManager.onClearChat = () => this.chatManager.clearChat();
        this.characterManager.onAddFirstMessage = async (message, characterName, characterAvatar, swipes = []) => {
            await this.chatManager.addMessage(message, 'assistant', characterName, characterAvatar, swipes, 0);
        };
        // 캐릭터 선택 시 상태 업데이트
        const originalSelectCharacter = this.characterManager.selectCharacter.bind(this.characterManager);
        this.characterManager.selectCharacter = async (characterId) => {
            // 캐릭터 선택 처리 (기존 채팅 저장 및 새 채팅 로드 포함)
            await originalSelectCharacter(characterId);
            
            // 캐릭터 선택 상태 업데이트
            this.isCharacterSelected = true;
            
            // 입력창 표시
            const chatInputContainer = document.querySelector('.chat-input-container');
            if (chatInputContainer) {
                chatInputContainer.classList.add('visible');
            }
            
            // 홈화면/채팅 영역 표시 상태 업데이트
            this.updateHomeScreenVisibility();
            
            // DOM 업데이트 대기 (UI 상태가 완전히 반영되도록)
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        };

        // 6. 패널 관리자 (모든 모듈 참조 가능)
        this.panelManager = new PanelManager(this.elements, {
            importFile: (type) => this.fileManager.importFile(type),
            selectCharacter: (id) => this.characterManager.selectCharacter(id),
            openCharacterProfile: (id) => this.characterManager.openCharacterProfile(id),
            handleCharacterAction: (action, id) => this.characterManager.handleCharacterAction(action, id),
            handleChatAction: (action, id) => this.chatManager.handleChatAction(action, id),
            loadChat: (chatId) => this.chatManager.loadChat(chatId),
            handlePersonaAction: (action, id) => this.handlePersonaAction(action, id),
            saveCharacterProfile: (form) => this.characterManager.saveCharacterProfile(form),
            clearChat: () => this.chatManager.clearChat(),
            getCurrentCharacterId: () => this.characterManager.getCurrentCharacterId(),
            importRegex: (scriptType, characterId) => this.fileManager.importRegex(scriptType, characterId),
            exportRegex: (scriptType, characterId, scriptId) => this.fileManager.exportRegex(scriptType, characterId, scriptId),
            onOverlayClick: () => {
                this.menuManager.closeSideMenu();
                this.settingsManager.closeSettingsModal();
            },
        });

        // 7. 페이지 언로드 전 채팅 저장 (새로고침/닫기 전)
        // visibilitychange 이벤트 사용 (beforeunload보다 더 신뢰성 있음)
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'hidden' && this.chatManager && this.chatManager.currentCharacterId) {
                // 디바운스 타이머 취소하고 즉시 저장
                if (this.chatManager.saveChatDebounceTimer) {
                    clearTimeout(this.chatManager.saveChatDebounceTimer);
                    this.chatManager.saveChatDebounceTimer = null;
                }
                
                // 저장 중이 아니고 메시지가 있으면 저장
                if (!this.chatManager._isSavingChat && 
                    this.chatManager.elements?.chatMessages?.children?.length > 0) {
                    try {
                        await this.chatManager.saveChat();
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_INIT_1005', '페이지 가시성 변경 시 채팅 저장 중 오류가 발생했습니다', error);
                        }
                    }
                }
            }
        });
        
        // beforeunload도 추가 (추가 보장)
        window.addEventListener('beforeunload', () => {
            if (this.chatManager && this.chatManager.currentCharacterId) {
                // 디바운스 타이머 취소
                if (this.chatManager.saveChatDebounceTimer) {
                    clearTimeout(this.chatManager.saveChatDebounceTimer);
                    this.chatManager.saveChatDebounceTimer = null;
                }
                // 저장 중이 아니고 메시지가 있으면 저장 시도 (동기적 저장은 불가능하지만 최선을 다함)
                if (!this.chatManager._isSavingChat && 
                    this.chatManager.elements?.chatMessages?.children?.length > 0) {
                    // 비동기 저장은 보장되지 않지만, 디바운스 타이머는 취소하여 다음 로드 시 저장되도록 함
                }
            }
        });

        // 7. 캐릭터 관리자에 패널 관리자 연결
        this.characterManager.panelManager = this.panelManager;
        
        // 8. 전역 접근을 위해 window에 저장 (채팅 삭제 후 패널 새로고침용)
        window.panelManager = this.panelManager;
        window.chatManager = this.chatManager;

        // 8. 파일 관리자의 콜백 설정 (패널 관리자가 생성된 후)
        this.fileManager.callbacks.refreshPanelUI = (type) => {
            this.panelManager.refreshPanelUI(type);
        };
    }
    /**
     * 메뉴 항목 클릭 처리
     * @param {string} menu - 메뉴 타입
     */
    handleMenuClick(menu) {
        switch (menu) {
            case 'characters':
                this.characterManager.openCharactersPanel();
                break;
            case 'settings':
                this.settingsManager.openSettingsModal();
                break;
            case 'app-settings':
                // 앱 설정은 서브메뉴 그룹이므로 여기서는 처리하지 않음
                break;
            case 'chat-processing':
                this.openChatProcessingPanel();
                break;
            case 'data-management':
                this.openDataManagementPanel();
                break;
            case 'world-info':
                this.openWorldInfoPanel();
                break;
            case 'quick-reply':
                this.openQuickReplyPanel();
                break;
            case 'personas':
                this.openPersonaPanel();
                break;
            case 'regex':
                this.openRegexPanel();
                break;
            case 'status-bar-choice':
                this.openStatusBarChoicePanel();
                break;
            case 'ai-loading':
                this.aILoadingPanel();
                break;
            case 'prompts':
                this.openPromptsPanel();
                break;
            case 'templates':
                this.openTemplatesPanel();
                break;
            case 'autofill-prompt':
                this.openAutofillPromptPanel();
                break;
            default:
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_APP_20005', `알 수 없는 메뉴: ${menu}`);
                }
        }
    }

    /**
     * 월드인포 패널 열기
     */
    async openWorldInfoPanel() {
        const panelHtml = await createWorldInfoPanel();
        this.panelManager.openPanelModal(panelHtml, 'world-info');
    }

    /**
     * 상태창/선택지 패널 열기
     */
    async openStatusBarChoicePanel() {
        const panelHtml = await createStatusBarChoicePanel();
        this.panelManager.openPanelModal(panelHtml, 'status-bar-choice');
    }

    /**
     * Quick Reply 패널 열기
     */
    async openQuickReplyPanel() {
        const panelHtml = await createQuickReplyPanel();
        this.panelManager.openPanelModal(panelHtml, 'quick-reply');
    }

    /**
     * 채팅 처리 패널 열기
     */
    async openChatProcessingPanel() {
        const panelHtml = await createChatProcessingPanel();
        this.panelManager.openPanelModal(panelHtml, 'chat-processing');
    }

    /**
     * 데이터 관리 패널 열기
     */
    async openDataManagementPanel() {
        const panelHtml = await createDataManagementPanel();
        this.panelManager.openPanelModal(panelHtml, 'data-management');
    }

    /**
     * 프롬프트 패널 열기 (Chat Completion Presets)
     */
    async openPromptsPanel() {
        const panelHtml = await window.createPromptsPanel();
        this.panelManager.openPanelModal(panelHtml, 'prompts');
    }

    /**
     * 템플릿 패널 열기 (컨텍스트 템플릿, 지시 템플릿, 시스템 프롬프트)
     */
    async openTemplatesPanel() {
        const panelHtml = await createTemplatesPanel();
        this.panelManager.openPanelModal(panelHtml, 'templates');
    }

    /**
     * 대필 지시문 패널 열기
     */
    async openAutofillPromptPanel() {
        // createAutofillPromptPanel - 전역 스코프에서 사용
        const panelHtml = await createAutofillPromptPanel();
        this.panelManager.openPanelModal(panelHtml, 'autofill-prompt');
    }

    /**
     * 페르소나 패널 열기
     */
    async openPersonaPanel() {
        const panelHtml = await createPersonaPanel();
        this.panelManager.openPanelModal(panelHtml, 'persona');
    }

    /**
     * AI 로딩 설정 패널 열기
     */
    async aILoadingPanel() {
        // createAILoadingPanel - 전역 스코프에서 사용
        const panelHtml = await createAILoadingPanel();
        this.panelManager.openPanelModal(panelHtml, 'ai-loading');
    }
    
    async openRegexPanel() {
        // 오직 UI만 확인 - 가장 확실한 방법
        const uiCharName = this.elements.charName.textContent;
        const isCharacterSelectedInUI = uiCharName && 
            uiCharName !== '캐릭터 선택' && 
            uiCharName !== '캐릭터를 선택하세요' && 
            uiCharName.trim() !== '';
        
        let currentCharacterId = null;
        if (isCharacterSelectedInUI) {
            // UI에 캐릭터가 표시되어 있으면 저장된 캐릭터 ID 사용
            currentCharacterId = await this.characterManager.getCurrentCharacterId();
            this.isCharacterSelected = true;
        } else {
            // UI에 "캐릭터 선택" 또는 "캐릭터를 선택하세요"가 표시되어 있으면 초기화면 상태
            currentCharacterId = null;
            this.isCharacterSelected = false;
        }
        
        const panelHtml = await createRegexPanel(currentCharacterId);
        this.panelManager.openPanelModal(panelHtml, 'regex');
    }

    /**
     * 페르소나 액션 처리
     * @param {string} action - 액션 타입
     * @param {string} id - 페르소나 ID
     */
    async handlePersonaAction(action, id) {
        // UserPersonaStorage, SettingsStorage - 전역 스코프에서 사용
        
        switch (action) {
            case 'edit':
                // 페르소나 편집 패널 열기 (전역 스코프에서 사용)
                const editorHtml = await createPersonaEditorPanel(id);
                
                // 기존 패널이 있고 페르소나 목록 패널이면 내용만 교체 (패널 닫지 않음)
                const existingPersonaPanel = document.getElementById('panel-modal-container');
                let personaPanelContainer;
                
                // 페르소나 목록 패널 확인: persona-panel 클래스 또는 #persona-import-btn 같은 고유 요소 확인
                const isPersonaPanel = existingPersonaPanel && (
                    existingPersonaPanel.querySelector('.persona-panel') ||
                    existingPersonaPanel.querySelector('#persona-import-btn') ||
                    existingPersonaPanel.querySelector('[data-panel-type="persona"]')
                );
                
                if (isPersonaPanel) {
                    // 패널 내용만 교체 (애니메이션 적용)
                    existingPersonaPanel.classList.add('closing');
                    existingPersonaPanel.style.pointerEvents = 'none';
                    
                    await new Promise(resolve => {
                        const handleAnimationEnd = () => {
                            existingPersonaPanel.removeEventListener('animationend', handleAnimationEnd);
                            resolve();
                        };
                        existingPersonaPanel.addEventListener('animationend', handleAnimationEnd);
                        setTimeout(() => {
                            existingPersonaPanel.removeEventListener('animationend', handleAnimationEnd);
                            resolve();
                        }, 300); // 타임아웃
                    });
                    
                    existingPersonaPanel.classList.remove('closing');
                    existingPersonaPanel.innerHTML = editorHtml;
                    existingPersonaPanel.style.opacity = '0';
                    existingPersonaPanel.style.transform = 'translateY(20px) scale(0.95)';
                    existingPersonaPanel.style.pointerEvents = '';
                    personaPanelContainer = existingPersonaPanel;
                    
                    // DOM이 완전히 렌더링될 때까지 대기
                    await new Promise(resolve => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    });
                    
                    // 애니메이션 시작 - 약간의 지연을 두어 DOM이 완전히 준비되도록 함
                    await new Promise(resolve => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    });
                    
                    // opacity와 transform을 명시적으로 설정
                    existingPersonaPanel.style.transition = 'all var(--transition-normal)';
                    existingPersonaPanel.style.opacity = '1';
                    existingPersonaPanel.style.transform = 'translateY(0) scale(1)';
                    existingPersonaPanel.style.visibility = 'visible';
                } else {
                    // 기존 패널이 없거나 다른 패널이면 새로 생성
                    personaPanelContainer = document.createElement('div');
                    personaPanelContainer.id = 'panel-modal-container';
                    personaPanelContainer.className = 'modal';
                    personaPanelContainer.innerHTML = editorHtml;
                    document.body.appendChild(personaPanelContainer);
                    this.panelManager.elements.overlay.classList.remove('hidden');
                    
                    // 패널 클릭 핸들러 설정
                    this.panelManager.setupPanelClickHandler(personaPanelContainer);
                }
                
                setupPersonaEditorEvents(personaPanelContainer, async (personaId, personaData) => {
                    // 저장 후 페르소나 목록 새로고침 (전역 스코프에서 사용)
                    const newPanelHtml = await createPersonaPanel();
                    personaPanelContainer.innerHTML = newPanelHtml;
                    
                    // 이벤트 리스너 재설정 (닫기 버튼 포함)
                    this.panelManager.setupPersonaPanelEvents(personaPanelContainer);
                    const closeBtn = personaPanelContainer.querySelector('.close-panel-btn');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.panelManager.closePanelModal());
                    }
                });
                
                // 닫기 버튼 이벤트는 setupPersonaEditorEvents 내부에서 처리됨
                break;
                
            case 'select':
                // 실리태번과 동일: 페르소나 선택 및 설정에 저장
                const persona = await UserPersonaStorage.load(id);
                if (!persona) {
                    showToast('페르소나를 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const settings = await SettingsStorage.load();
                settings.currentPersonaId = id;
                settings.persona_description = persona.description || '';
                settings.persona_description_position = persona.position ?? 0;
                await SettingsStorage.save(settings);
                
                // 패널 새로고침 (전역 스코프에서 사용)
                const panelHtml = await createPersonaPanel();
                const currentPanel = document.getElementById('panel-modal-container');
                if (currentPanel) {
                    currentPanel.innerHTML = panelHtml;
                    this.panelManager.setupPersonaPanelEvents(currentPanel);
                }
                
                showToast(`"${persona.name}" 페르소나가 선택되었습니다.`, 'success');
                break;
                
            case 'export':
                // TODO: 페르소나 내보내기 기능 (실리태번 형식)
                showToast('내보내기 기능은 추후 구현 예정입니다.', 'info');
                break;
                
            case 'delete':
                // 실리태번과 동일: 확인 후 삭제
                const confirmed = await showConfirmModal('이 페르소나를 삭제하시겠습니까?', '페르소나 삭제', { confirmType: 'danger' });
                if (confirmed) {
                    try {
                        const settings = await SettingsStorage.load();
                        
                        // 현재 선택된 페르소나가 삭제되는 경우 선택 해제
                        if (settings.currentPersonaId === id) {
                            settings.currentPersonaId = null;
                            settings.persona_description = '';
                            settings.persona_description_position = 0;
                            await SettingsStorage.save(settings);
                        }
                        
                        await UserPersonaStorage.delete(id);
                        
                        // 패널 새로고침
                        // createPersonaPanel - 전역 스코프에서 사용
                        const panelHtml = await createPersonaPanel();
                        const currentPanel = document.getElementById('panel-modal-container');
                        if (currentPanel) {
                            currentPanel.innerHTML = panelHtml;
                            this.panelManager.setupPersonaPanelEvents(currentPanel);
                        }
                        
                        showToast('페르소나가 삭제되었습니다.', 'success');
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_PERSONA_12003', '페르소나 삭제 중 오류가 발생했습니다', error);
                        } else if (typeof showToast === 'function') {
                            showToast('페르소나 삭제 중 오류가 발생했습니다.', 'error');
                        }
                    }
                }
                break;
        }
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MobileChatApp();
});
