/**
 * 토스트 알림 시스템
 * 시간이 지나도 사라지지 않으며, 사용자가 닫기 버튼을 눌러야만 사라집니다.
 */

/**
 * 토스트 알림 표시
 * @param {string} message - 알림 메시지
 * @param {string} type - 알림 타입 ('error', 'warning', 'info', 'success')
 */
function showToast(message, type = 'info') {
    // 토스트 컨테이너가 없으면 생성
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // 토스트 아이템 생성
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // 아이콘 선택
    let icon = '';
    switch (type) {
        case 'error':
            icon = '<i class="fa-solid fa-circle-exclamation"></i>';
            break;
        case 'warning':
            icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
            break;
        case 'success':
        case 'info': // info도 성공과 동일하게 처리
            icon = '<i class="fa-solid fa-circle-check"></i>';
            break;
        default:
            icon = '<i class="fa-solid fa-circle-info"></i>';
            break;
    }

    // 메시지 이스케이프
    const escapedMessage = escapeHtml(message);

    // 모든 토스트에 자동 닫힘 기능 적용
    const isAutoClose = true;
    
    // 토스트 HTML 구성
    let toastHTML = `
        <div class="toast-wrapper">
            <div class="toast-content">
                <div class="toast-icon">${icon}</div>
                <div class="toast-message">${escapedMessage}</div>
            </div>
            <button class="toast-close" aria-label="닫기">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
    
    // 모든 토스트에 프로그래스 바 추가
    toastHTML += `
        <div class="toast-progress-bar">
            <div class="toast-progress-fill"></div>
        </div>
    `;
    
    toast.innerHTML = toastHTML;

    // 닫기 버튼 이벤트
    const closeBtn = toast.querySelector('.toast-close');
    let closeTimer = null;
    let progressTimer = null;
    
    // 토스트 닫기 함수
    const closeToast = () => {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        toast.classList.add('toast-closing');
        setTimeout(() => {
            toast.remove();
            // 토스트가 없으면 컨테이너 제거
            if (toastContainer && toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeToast);

    // 토스트 추가
    toastContainer.appendChild(toast);

    // 애니메이션을 위한 약간의 지연
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
            
            // 모든 토스트에 자동 닫기 설정
            if (isAutoClose) {
                const progressFill = toast.querySelector('.toast-progress-fill');
                // 타입별 자동 닫힘 시간 설정
                let duration;
                if (type === 'success' || type === 'info') {
                    duration = 5000; // 초록 토스트: 5초
                } else if (type === 'warning' || type === 'error') {
                    duration = 15000; // 노랑/빨강 토스트: 15초
                } else {
                    duration = 12000; // 기본값: 12초
                }
                const updateInterval = 50; // 50ms마다 업데이트
                let totalElapsed = 0; // 누적 경과 시간
                let lastStartTime = Date.now(); // 마지막 시작 시간
                let isPaused = false;
                let backupTimerRemaining = duration; // 백업 타이머 남은 시간
                
                // 프로그래스 바 애니메이션 시작
                const startProgress = () => {
                    if (isPaused) return;
                    
                    lastStartTime = Date.now();
                    progressTimer = setInterval(() => {
                        if (isPaused) return;
                        
                        const now = Date.now();
                        const elapsedSinceStart = now - lastStartTime;
                        const total = totalElapsed + elapsedSinceStart;
                        
                        const progress = Math.min((total / duration) * 100, 100);
                        progressFill.style.width = progress + '%';
                        
                        if (progress >= 100) {
                            clearInterval(progressTimer);
                            if (closeTimer) clearTimeout(closeTimer);
                            closeToast();
                        }
                    }, updateInterval);
                };
                
                // 호버 시 일시정지/재개
                toast.addEventListener('mouseenter', () => {
                    if (progressTimer) {
                        // 일시정지 시까지 경과한 시간을 누적
                        const now = Date.now();
                        totalElapsed += (now - lastStartTime);
                        const elapsed = now - lastStartTime;
                        backupTimerRemaining -= elapsed;
                        
                        clearInterval(progressTimer);
                        progressTimer = null;
                        
                        // 백업 타이머도 일시정지
                        if (closeTimer) {
                            clearTimeout(closeTimer);
                            closeTimer = null;
                        }
                    }
                    isPaused = true;
                    toast.classList.add('toast-paused');
                });
                
                toast.addEventListener('mouseleave', () => {
                    isPaused = false;
                    toast.classList.remove('toast-paused');
                    // 재개 시 새로운 시작 시간 기록
                    lastStartTime = Date.now();
                    startProgress();
                    
                    // 백업 타이머 재시작
                    if (backupTimerRemaining > 0) {
                        closeTimer = setTimeout(closeToast, backupTimerRemaining);
                    }
                });
                
                // 초기 타이머 시작
                lastStartTime = Date.now();
                startProgress();
                
                // 12초 후 자동 닫기 (백업용)
                closeTimer = setTimeout(closeToast, duration);
            }
        });
    });
}

/**
 * HTML 이스케이프 유틸리티
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 오류 코드 토스트 알림 표시
 * @param {string} errorCode - 오류 코드 (예: 'ERR_CHAT_3001', 'WARN_CHAT_20001')
 * @param {string} description - 오류 설명
 * @param {Error|object} error - 에러 객체 (선택사항, 추가 정보 표시용)
 */
function showErrorCodeToast(errorCode, description, error = null) {
    // 토스트 컨테이너가 없으면 생성
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // 오류 코드 타입 확인 (ERR_ 또는 WARN_)
    const isError = errorCode.startsWith('ERR_');
    const isWarning = errorCode.startsWith('WARN_');
    
    // 타입에 따른 클래스명과 색상 설정
    let toastClass = 'toast-error-code';
    let icon = '<i class="fa-solid fa-bug"></i>'; // 기본 아이콘
    
    if (isError) {
        toastClass = 'toast-error-code';
        icon = '<i class="fa-solid fa-circle-xmark"></i>'; // 에러 아이콘
    } else if (isWarning) {
        toastClass = 'toast-warning-code';
        icon = '<i class="fa-solid fa-triangle-exclamation"></i>'; // 경고 아이콘
    }

    // 토스트 아이템 생성
    const toast = document.createElement('div');
    toast.className = `toast ${toastClass}`;
    
    // 오류 코드와 설명 메시지 구성
    let messageText = `<strong>[${escapeHtml(errorCode)}]</strong><br>${escapeHtml(description)}`;
    
    // 추가 에러 정보가 있으면 표시
    if (error && error.message) {
        messageText += `<br><span style="opacity: 0.8; font-size: 12px;">${escapeHtml(error.message)}</span>`;
    }
    
    // 모든 토스트에 자동 닫힘 기능 적용
    const isAutoClose = true;
    
    let toastHTML = `
        <div class="toast-wrapper">
        <div class="toast-content">
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${messageText}</div>
        </div>
        <button class="toast-close" aria-label="닫기">
            <i class="fa-solid fa-xmark"></i>
        </button>
        </div>
    `;
    
    // 모든 토스트에 프로그래스 바 추가
    toastHTML += `
        <div class="toast-progress-bar">
            <div class="toast-progress-fill"></div>
        </div>
    `;
    
    toast.innerHTML = toastHTML;

    // 닫기 버튼 이벤트
    const closeBtn = toast.querySelector('.toast-close');
    let closeTimer = null;
    let progressTimer = null;
    
    // 토스트 닫기 함수
    const closeToast = () => {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        toast.classList.add('toast-closing');
        setTimeout(() => {
            toast.remove();
            // 토스트가 없으면 컨테이너 제거
            if (toastContainer && toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeToast);

    // 토스트 추가
    toastContainer.appendChild(toast);

    // 애니메이션을 위한 약간의 지연
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
            
            // 모든 토스트에 자동 닫기 설정
            if (isAutoClose) {
                const progressFill = toast.querySelector('.toast-progress-fill');
                if (!progressFill) {
                    console.error('[showErrorCodeToast] 프로그래스 바를 찾을 수 없습니다:', {
                        toastClass: toast.className,
                        toastHTML: toast.innerHTML.substring(0, 200)
                    });
                    // 프로그래스 바가 없어도 백업 타이머로 자동 닫기 실행
                }
                // 타입별 자동 닫힘 시간 설정
                let duration;
                if (isError) {
                    duration = 15000; // 오류 토스트: 15초
                } else if (isWarning) {
                    duration = 15000; // 경고 토스트: 15초
                } else {
                    duration = 12000; // 기본값: 12초
                }
                const updateInterval = 50; // 50ms마다 업데이트
                let totalElapsed = 0; // 누적 경과 시간
                let lastStartTime = Date.now(); // 마지막 시작 시간
                let isPaused = false;
                let backupTimerRemaining = duration; // 백업 타이머 남은 시간
                
                // 프로그래스 바 애니메이션 시작
                const startProgress = () => {
                    if (isPaused) return;
                    if (!progressFill) {
                        // 프로그래스 바가 없으면 백업 타이머만 사용
                        return;
                    }
                    
                    lastStartTime = Date.now();
                    progressTimer = setInterval(() => {
                        if (isPaused) return;
                        if (!progressFill) return;
                        
                        const now = Date.now();
                        const elapsedSinceStart = now - lastStartTime;
                        const total = totalElapsed + elapsedSinceStart;
                        
                        const progress = Math.min((total / duration) * 100, 100);
                        progressFill.style.width = progress + '%';
                        
                        if (progress >= 100) {
                            clearInterval(progressTimer);
                            if (closeTimer) clearTimeout(closeTimer);
                            closeToast();
                        }
                    }, updateInterval);
                };
                
                // 호버 시 일시정지/재개
                toast.addEventListener('mouseenter', () => {
                    if (progressTimer) {
                        // 일시정지 시까지 경과한 시간을 누적
                        const now = Date.now();
                        totalElapsed += (now - lastStartTime);
                        const elapsed = now - lastStartTime;
                        backupTimerRemaining -= elapsed;
                        
                        clearInterval(progressTimer);
                        progressTimer = null;
                        
                        // 백업 타이머도 일시정지
                        if (closeTimer) {
                            clearTimeout(closeTimer);
                            closeTimer = null;
                        }
                    }
                    isPaused = true;
                    toast.classList.add('toast-paused');
                });
                
                toast.addEventListener('mouseleave', () => {
                    isPaused = false;
                    toast.classList.remove('toast-paused');
                    // 재개 시 새로운 시작 시간 기록
                    lastStartTime = Date.now();
                    startProgress();
                    
                    // 백업 타이머 재시작
                    if (backupTimerRemaining > 0) {
                        closeTimer = setTimeout(closeToast, backupTimerRemaining);
                    }
                });
                
                // 초기 타이머 시작
                lastStartTime = Date.now();
                startProgress();
                
                // 백업 타이머 시작 (프로그래스 바가 없어도 자동 닫기 보장)
                closeTimer = setTimeout(closeToast, duration);
            }
        });
    });
}

/**
 * 확인 다이얼로그 모달 표시 (confirm 대체)
 * @param {string} message - 확인 메시지
 * @param {string} title - 모달 제목 (선택사항)
 * @param {object} options - 옵션 객체
 * @param {string} options.confirmText - 확인 버튼 텍스트 (기본값: '확인')
 * @param {string} options.cancelText - 취소 버튼 텍스트 (기본값: '취소')
 * @param {string} options.confirmType - 확인 버튼 타입 ('danger' | 'primary', 기본값: 'primary')
 * @returns {Promise<boolean>} 확인 시 true, 취소 시 false
 */
function showConfirmModal(message, title = '확인', options = {}) {
    const {
        confirmText = '확인',
        cancelText = '취소',
        confirmType = 'primary'
    } = options;

    return new Promise((resolve) => {
        // 기존 모달이 있으면 먼저 제거
        const existingModal = document.getElementById('confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.id = 'confirm-modal-overlay';

        // 모달 컨테이너 생성
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'confirm-modal';

        // 모달 컨텐츠 생성
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // 모달 헤더 생성
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        const headerTitle = document.createElement('h2');
        headerTitle.textContent = title;
        modalHeader.appendChild(headerTitle);

        // 모달 바디 생성
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        const messageParagraph = document.createElement('p');
        messageParagraph.style.cssText = `
            margin: 0;
            color: var(--text-primary);
            line-height: 1.6;
            white-space: pre-line;
        `;
        messageParagraph.textContent = message;
        modalBody.appendChild(messageParagraph);

        // 모달 푸터 생성
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.style.cssText = `
            display: flex;
            gap: var(--spacing-md);
            justify-content: flex-end;
            padding: var(--spacing-lg);
            border-top: 1px solid var(--border-color);
        `;

        // 취소 버튼 생성
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelText;
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.cssText = `
            padding: var(--spacing-md) var(--spacing-xl);
            font-size: var(--font-size-md);
            font-weight: 600;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all var(--transition-fast);
            border: 1px solid var(--border-color);
            background: var(--bg-tertiary);
            color: var(--text-primary);
            min-width: 100px;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'var(--bg-secondary)';
            cancelBtn.style.borderColor = 'var(--accent-green)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'var(--bg-tertiary)';
            cancelBtn.style.borderColor = 'var(--border-color)';
        });
        cancelBtn.addEventListener('click', () => {
            closeModal(false);
        });

        // 확인 버튼 생성
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn btn-${confirmType}`;
        const isDanger = confirmType === 'danger';
        confirmBtn.style.cssText = `
            padding: var(--spacing-md) var(--spacing-xl);
            font-size: var(--font-size-md);
            font-weight: 600;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all var(--transition-fast);
            border: none;
            min-width: 100px;
            ${isDanger ? `
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #f87171;
            ` : `
                background: var(--accent-green);
                color: white;
            `}
        `;
        confirmBtn.addEventListener('mouseenter', () => {
            if (isDanger) {
                confirmBtn.style.background = 'rgba(239, 68, 68, 0.25)';
                confirmBtn.style.color = '#fca5a5';
            } else {
                confirmBtn.style.background = 'var(--accent-green-dark, #388e3c)';
            }
        });
        confirmBtn.addEventListener('mouseleave', () => {
            if (isDanger) {
                confirmBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                confirmBtn.style.color = '#f87171';
            } else {
                confirmBtn.style.background = 'var(--accent-green)';
            }
        });
        confirmBtn.addEventListener('click', () => {
            closeModal(true);
        });

        modalFooter.appendChild(cancelBtn);
        modalFooter.appendChild(confirmBtn);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);

        // 모달 닫기 함수
        const closeModal = (result) => {
            modal.classList.add('hidden');
            overlay.classList.add('hidden');
            setTimeout(() => {
                modal.remove();
                overlay.remove();
            }, 300);
            resolve(result);
        };

        // 오버레이 클릭 시 취소
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(false);
            }
        });

        // ESC 키로 취소
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // DOM에 추가
        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // 애니메이션 트리거
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                modal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                setTimeout(() => {
                    modal.style.opacity = '1';
                    modal.style.transform = 'scale(1)';
                }, 10);
            });
        });
    });
}

/**
 * 새 채팅 시작 확인 다이얼로그 모달 표시
 * @param {boolean} hasCurrentChat - 현재 채팅이 있는지 여부
 * @returns {Promise<{confirmed: boolean, deleteCurrentChat: boolean}>} 확인 결과
 */
function showNewChatConfirmModal(hasCurrentChat = false) {
    return new Promise((resolve) => {
        // 기존 모달이 있으면 먼저 제거
        const existingModal = document.getElementById('new-chat-confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }
        const existingOverlay = document.getElementById('new-chat-confirm-modal-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.id = 'new-chat-confirm-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
            cursor: pointer;
        `;

        // 모달 컨테이너 생성
        // .modal 클래스를 사용하지 않고 별도 클래스 사용 (CSS 기본 스타일 충돌 방지)
        const modal = document.createElement('div');
        modal.className = 'new-chat-confirm-modal';
        modal.id = 'new-chat-confirm-modal';
        // 초기 스타일 설정 (DOM에 추가되기 전에 완전히 설정)
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
            visibility: hidden;
            margin: 0;
            width: auto;
            height: auto;
            display: block;
        `;

        // 모달 컨텐츠 생성
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        // 모달 컨텐츠 기본 스타일 설정
        modalContent.style.cssText = `
            pointer-events: auto;
            background: var(--bg-secondary);
            border-radius: var(--border-radius-lg);
            padding: 0;
            max-width: 600px;
            min-width: 400px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        `;

        // 모달 헤더 생성
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        const headerTitle = document.createElement('h2');
        headerTitle.textContent = '새 채팅 시작';
        modalHeader.appendChild(headerTitle);

        // 모달 바디 생성
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        const messageParagraph = document.createElement('p');
        messageParagraph.style.cssText = `
            margin: 0 0 var(--spacing-md) 0;
            color: var(--text-primary);
            line-height: 1.6;
            white-space: pre-line;
        `;
        messageParagraph.textContent = '새 채팅을 시작하시겠습니까?';
        modalBody.appendChild(messageParagraph);

        // 체크박스 컨테이너 생성 (현재 채팅이 있을 때만 표시)
        let checkboxContainer = null;
        let checkbox = null;
        if (hasCurrentChat) {
            checkboxContainer = document.createElement('div');
            checkboxContainer.style.cssText = `
                margin-top: var(--spacing-md);
                padding: var(--spacing-md);
                background: var(--bg-tertiary);
                border-radius: var(--border-radius);
                border: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                transition: all var(--transition-fast);
            `;
            checkboxContainer.addEventListener('mouseenter', () => {
                checkboxContainer.style.background = 'var(--bg-secondary)';
                checkboxContainer.style.borderColor = 'var(--accent-green)';
            });
            checkboxContainer.addEventListener('mouseleave', () => {
                checkboxContainer.style.background = 'var(--bg-tertiary)';
                checkboxContainer.style.borderColor = 'var(--border-color)';
            });

            // 체크박스 래퍼 생성 (커스텀 체크박스 스타일링용)
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.style.cssText = `
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            `;

            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'delete-current-chat-checkbox';
            checkbox.style.cssText = `
                position: absolute;
                opacity: 0;
                cursor: pointer;
                width: 100%;
                height: 100%;
                margin: 0;
                z-index: 1;
            `;

            // 커스텀 체크박스 표시용 div
            const checkboxDisplay = document.createElement('div');
            checkboxDisplay.style.cssText = `
                width: 20px;
                height: 20px;
                border: 2px solid var(--border-color);
                border-radius: 4px;
                background: var(--bg-primary);
                transition: all var(--transition-fast);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            `;

            // 체크 아이콘 (체크되었을 때 표시)
            const checkIcon = document.createElement('i');
            checkIcon.className = 'fa-solid fa-check';
            checkIcon.style.cssText = `
                font-size: 12px;
                color: white;
                opacity: 0;
                transition: opacity var(--transition-fast);
                transform: scale(0.8);
            `;
            checkboxDisplay.appendChild(checkIcon);

            // 체크박스 상태 변경 시 스타일 업데이트
            const updateCheckboxStyle = () => {
                if (checkbox.checked) {
                    checkboxDisplay.style.background = 'var(--accent-green)';
                    checkboxDisplay.style.borderColor = 'var(--accent-green)';
                    checkIcon.style.opacity = '1';
                    checkIcon.style.transform = 'scale(1)';
                } else {
                    checkboxDisplay.style.background = 'var(--bg-primary)';
                    checkboxDisplay.style.borderColor = 'var(--border-color)';
                    checkIcon.style.opacity = '0';
                    checkIcon.style.transform = 'scale(0.8)';
                }
            };

            checkbox.addEventListener('change', updateCheckboxStyle);
            checkbox.addEventListener('focus', () => {
                checkboxDisplay.style.boxShadow = '0 0 0 3px rgba(76, 175, 80, 0.2)';
            });
            checkbox.addEventListener('blur', () => {
                checkboxDisplay.style.boxShadow = 'none';
            });

            // 호버 효과
            checkbox.addEventListener('mouseenter', () => {
                if (!checkbox.checked) {
                    checkboxDisplay.style.borderColor = 'var(--accent-green)';
                    checkboxDisplay.style.background = 'var(--bg-secondary)';
                }
            });
            checkbox.addEventListener('mouseleave', () => {
                if (!checkbox.checked) {
                    checkboxDisplay.style.borderColor = 'var(--border-color)';
                    checkboxDisplay.style.background = 'var(--bg-primary)';
                }
            });

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(checkboxDisplay);

            const checkboxLabel = document.createElement('label');
            checkboxLabel.htmlFor = 'delete-current-chat-checkbox';
            checkboxLabel.style.cssText = `
                cursor: pointer;
                color: var(--text-primary);
                font-size: var(--font-size-md);
                user-select: none;
                flex: 1;
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            `;
            checkboxLabel.textContent = '현재 채팅 삭제하기';

            // 라벨 클릭 시에도 체크박스 토글
            checkboxLabel.addEventListener('click', (e) => {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });

            checkboxContainer.appendChild(checkboxWrapper);
            checkboxContainer.appendChild(checkboxLabel);
            modalBody.appendChild(checkboxContainer);
        }

        // 모달 푸터 생성
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.style.cssText = `
            display: flex;
            gap: var(--spacing-md);
            justify-content: flex-end;
            padding: var(--spacing-lg);
            border-top: 1px solid var(--border-color);
            flex-shrink: 0;
        `;

        // 취소 버튼 생성
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '취소';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.cssText = `
            padding: var(--spacing-md) var(--spacing-xl);
            font-size: var(--font-size-md);
            font-weight: 600;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all var(--transition-fast);
            border: 1px solid var(--border-color);
            background: var(--bg-tertiary);
            color: var(--text-primary);
            min-width: 80px;
            white-space: nowrap;
            flex-shrink: 0;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'var(--bg-secondary)';
            cancelBtn.style.borderColor = 'var(--accent-green)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'var(--bg-tertiary)';
            cancelBtn.style.borderColor = 'var(--border-color)';
        });
        cancelBtn.addEventListener('click', () => {
            closeModal(false);
        });

        // 확인 버튼 생성
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '시작';
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.style.cssText = `
            padding: var(--spacing-md) var(--spacing-xl);
            font-size: var(--font-size-md);
            font-weight: 600;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all var(--transition-fast);
            border: none;
            min-width: 80px;
            white-space: nowrap;
            flex-shrink: 0;
            background: var(--accent-green);
            color: white;
        `;
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = 'var(--accent-green-dark, #388e3c)';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = 'var(--accent-green)';
        });
        confirmBtn.addEventListener('click', () => {
            const deleteCurrentChat = checkbox ? checkbox.checked : false;
            closeModal(true, deleteCurrentChat);
        });

        modalFooter.appendChild(cancelBtn);
        modalFooter.appendChild(confirmBtn);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);

        // 모달 닫기 함수
        const closeModal = (confirmed, deleteCurrentChat = false) => {
            // 부드러운 닫힘 애니메이션
            modal.style.opacity = '0';
            modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
            modal.style.pointerEvents = 'none';
            overlay.style.opacity = '0';
            
            // 애니메이션 완료 후 DOM에서 제거
            setTimeout(() => {
                modal.remove();
                overlay.remove();
                resolve({ confirmed, deleteCurrentChat });
            }, 300); // transition 시간과 동일하게 설정
        };

        // 오버레이 클릭 시 취소 (모달 바깥 영역 클릭)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(false);
            }
        });
        
        // 모달 컨텐츠 클릭 시 이벤트 전파 방지 (모달 내부 클릭 시 닫히지 않도록)
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // ESC 키로 취소
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // DOM에 추가
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // 강제로 레이아웃 계산 (reflow) - DOM에 추가된 후
        // 이렇게 하면 브라우저가 위치를 계산할 수 있음
        const forceReflow = () => {
            void modal.offsetHeight;
            void overlay.offsetHeight;
        };
        
        // setTimeout을 사용하여 DOM이 완전히 추가된 후 레이아웃 계산
        setTimeout(() => {
            forceReflow();
            
            // 부드러운 열림 애니메이션
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // visibility를 먼저 visible로 설정 (레이아웃 계산 후)
                    modal.style.visibility = 'visible';
                    // 오버레이 페이드 인
                    overlay.style.opacity = '1';
                    // 모달 페이드 인 및 스케일
                    modal.style.opacity = '1';
                    modal.style.transform = 'translate(-50%, -50%) scale(1)';
                    modal.style.pointerEvents = 'auto';
                });
            });
        }, 0);
    });
}

