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

    // 초록색 토스트(success, info)인지 확인
    const isAutoClose = type === 'success' || type === 'info';
    
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
    
    // 초록색 토스트는 프로그래스 바 추가
    if (isAutoClose) {
        toastHTML += `
            <div class="toast-progress-bar">
                <div class="toast-progress-fill"></div>
            </div>
        `;
    }
    
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
            
            // 초록색 토스트는 자동 닫기 설정
            if (isAutoClose) {
                const progressFill = toast.querySelector('.toast-progress-fill');
                const duration = 12000; // 12초
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
    
    toast.innerHTML = `
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

    // 닫기 버튼 이벤트
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-closing');
        setTimeout(() => {
            toast.remove();
            // 토스트가 없으면 컨테이너 제거
            if (toastContainer && toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    });

    // 토스트 추가
    toastContainer.appendChild(toast);

    // 애니메이션을 위한 약간의 지연
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
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

