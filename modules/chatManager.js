/**
 * 채팅 관리 모듈
 * 메시지 전송, 채팅 로드, 채팅 표시
 */


/**
 * HTML 코드 블록을 iframe으로 변환
 * @param {string} text - 메시지 텍스트
 * @returns {string} - HTML 블록이 iframe으로 교체된 텍스트
 */
function processHtmlCodeBlocks(text) {
    if (!text) return text;
    
    // 백틱 3개로 감싼 코드 블록 찾기
    // 패턴: ``` 또는 ```html 또는 ```HTML 등으로 시작하고 ```로 끝남
    // greedy 매칭 사용하여 여러 줄의 코드 블록도 정확히 캡처
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]+?)```/g;
    
    const htmlBlocks = [];
    let blockIndex = 0;
    
    // HTML 코드 블록을 찾아서 임시 마커로 교체 (Showdown이 변환하지 않도록)
    const processedText = text.replace(codeBlockRegex, (match, language, code) => {
        const lang = language ? language.toLowerCase().trim() : '';
        const codeContent = code.trim();
        
        // 언어가 'html'이거나 없고, 코드에 HTML 태그가 포함되어 있는 경우
        const hasHtmlTags = /<[^>]+>/.test(codeContent);
        const isHtml = lang === 'html' || (lang === '' && hasHtmlTags);
        
        if (isHtml && codeContent) {
            // 고유 ID 생성
            const iframeId = 'html-render-' + Date.now() + '-' + blockIndex + '-' + Math.random().toString(36).substr(2, 9);
            blockIndex++;
            
            // HTML 원본 저장 (나중에 복원하기 위해)
            htmlBlocks.push({
                id: iframeId,
                html: codeContent
            });
            
            // 임시 마커로 교체 (Showdown이 이 부분을 건드리지 않도록)
            return `\n<!-- HTML_IFRAME_MARKER:${iframeId} -->\n`;
        }
        
        // HTML이 아닌 경우 원본 반환
        return match;
    });
    
    // 마커와 HTML 데이터를 함께 반환
    return {
        text: processedText,
        htmlBlocks: htmlBlocks
    };
}

/**
 * HTML iframe 플레이스홀더를 실제 iframe으로 변환
 * @param {string} html - HTML 문자열 (iframe 플레이스홀더 포함)
 * @returns {HTMLElement} - 변환된 DOM 요소
 */
function renderHtmlIframes(html) {
    if (!html) return document.createDocumentFragment();
    
    // 임시 컨테이너 생성
    const container = document.createElement('div');
    container.innerHTML = html;
    
    // iframe 플레이스홀더 찾기
    const textNodes = [];
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.includes('[HTML_IFRAME:')) {
            textNodes.push(node);
        }
    }
    
    // 각 플레이스홀더를 iframe으로 교체
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const iframeRegex = /\[HTML_IFRAME:([^\:]+):([^\]]+)\]/g;
        
        let match;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        
        while ((match = iframeRegex.exec(text)) !== null) {
            // 플레이스홀더 앞의 텍스트 추가
            if (match.index > lastIndex) {
                const beforeText = text.substring(lastIndex, match.index);
                fragment.appendChild(document.createTextNode(beforeText));
            }
            
            const iframeId = match[1];
            const escapedHtml = match[2];
            let htmlContent = escapedHtml
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'");
            
            // triggerSlash 함수가 이미 정의되어 있는지 확인
            const hasTriggerSlash = /function\s+triggerSlash|const\s+triggerSlash|let\s+triggerSlash|var\s+triggerSlash/.test(htmlContent);
            
            // triggerSlash 함수 정의 (없는 경우에만 추가)
            // iframe 내부에서는 executeSlashCommands에 직접 접근할 수 없도록 함
            const triggerSlashScript = `
<script>
// iframe에서 부모 창으로 슬래시 명령어를 전송하는 함수
function triggerSlash(command) {
    if (typeof command !== 'string') {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            const commandType = typeof command;
            showErrorCodeToast('WARN_CHAT_20001', 'iframe 명령어 타입이 유효하지 않음: ' + commandType);
        }
        return;
    }
    try {
        // 부모 창(window.parent)으로 postMessage 전송
        // 부모 창의 setupIframeMessageListener가 처리함
        window.parent.postMessage({
            type: 'executeSlashCommand',
            command: command
        }, '*');
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_CHAT_3001', 'iframe postMessage 전송 오류가 발생했습니다', error);
        }
    }
}

// iframe 내부에서 executeSlashCommands를 직접 호출할 수 있도록 허용
// executeSlashCommands가 자동으로 window.app에서 chatManager와 characterManager를 찾음
// 따라서 iframe 내부에서도 executeSlashCommands(commandText)로 직접 호출 가능
</script>`;
            
            if (!hasTriggerSlash) {
                // htmlContent에 triggerSlash 함수 추가
                // 완전한 HTML 문서인지 확인
                if (/<html[\s>]|<head[\s>]|<body[\s>]/i.test(htmlContent)) {
                    // 완전한 HTML 문서인 경우
                    if (/<head[\s>]/i.test(htmlContent)) {
                        // <head> 태그 다음에 스크립트 추가
                        htmlContent = htmlContent.replace(/(<head[^>]*>)/i, `$1${triggerSlashScript}`);
                    } else if (/<html[\s>]/i.test(htmlContent)) {
                        // <html> 태그 다음에 스크립트 추가
                        htmlContent = htmlContent.replace(/(<html[^>]*>)/i, `$1${triggerSlashScript}`);
                    } else if (/<body[\s>]/i.test(htmlContent)) {
                        // <body> 태그 다음에 스크립트 추가
                        htmlContent = htmlContent.replace(/(<body[^>]*>)/i, `$1${triggerSlashScript}`);
                    }
                } else {
                    // HTML 조각인 경우, 전체를 감싸고 스크립트 추가
                    htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body>
${triggerSlashScript}
${htmlContent}
</body>
</html>`;
                }
            }
            
            // iframe 생성
            const iframe = document.createElement('iframe');
            iframe.id = iframeId;
            iframe.className = 'message-html-iframe';
            iframe.srcdoc = htmlContent;
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
            iframe.scrolling = 'no'; // 스크롤 제거
            iframe.style.cssText = `
                width: 100%;
                min-height: 50px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: var(--border-radius-md);
                background: white;
                margin: var(--spacing-md) 0;
                overflow: hidden;
            `;
            
            // iframe 로드 후 높이 자동 조절 (renderHtmlIframesInElement에서 처리하므로 여기서는 최소만 설정)
            // 실제 높이 조절은 renderHtmlIframesInElement에서 처리됨
            
            fragment.appendChild(iframe);
            lastIndex = iframeRegex.lastIndex;
        }
        
        // 마지막 텍스트 추가
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        
        // 텍스트 노드를 프래그먼트로 교체
        textNode.parentNode.replaceChild(fragment, textNode);
    });
    
    return container;
}

/**
 * 메시지를 HTML로 포맷팅 (마크다운 변환)
 * @param {string} text - 메시지 텍스트
 * @param {string} userName - 사용자 이름 (매크로 치환용, 선택)
 * @param {string} charName - 캐릭터 이름 (매크로 치환용, 선택)
 * @returns {string} - HTML 문자열
 */
function messageFormatting(text, userName = '', charName = '') {
    if (!text) return '';
    
    // 정규식으로 생성된 <Button>...</Button> 태그를 찾아서 처리
    // 주의: 이 함수는 이미 정규식이 적용된 텍스트를 받습니다
    // 정규식이 <Button> 태그를 HTML로 교체한 경우를 처리하고,
    // 교체되지 않은 <Button> 태그가 남아있는 경우도 처리합니다
    // <Button>...</Button> 내부의 HTML을 iframe으로 렌더링하기 위해
    // 모든 <Button> 태그를 코드 블록으로 보호 (Showdown이 변환하지 않도록)
    const buttonTagRegex = /<Button>([\s\S]*?)<\/Button>/gi;
    let processedText = text;
    const buttonBlocks = []; // Button 태그 정보 저장
    
    // 모든 매칭을 역순으로 처리 (뒤에서부터 앞으로)하여 인덱스 변경 문제 방지
    const buttonMatches = [...text.matchAll(buttonTagRegex)];
    const processedMatches = new Set();
    
    // 역순으로 처리하여 인덱스 변경 문제 방지
    for (let i = buttonMatches.length - 1; i >= 0; i--) {
        const match = buttonMatches[i];
        const buttonContent = match[1].trim(); // Button 태그 내부 콘텐츠
        const fullButtonTag = match[0]; // <Button>...</Button> 전체
        const matchIndex = match.index; // 매칭 시작 위치
        
        // 이미 처리한 매칭은 건너뛰기 (같은 위치의 동일한 태그)
        const matchKey = `${matchIndex}-${fullButtonTag}`;
        if (processedMatches.has(matchKey)) {
            continue;
        }
        
        // Button 태그 내부에 HTML 구조가 있는지 확인
        // <!DOCTYPE, <html, <head, <body, <div, <style, <script 등이 있으면 HTML 구조로 판단
        const hasHtmlStructure = /<!DOCTYPE|<\/?html|<\/?head|<\/?body|<div[^>]*>|<style|<script/i.test(buttonContent);
        
        // 빈 태그가 아닌 경우만 처리
        if (buttonContent.length > 0) {
            // 고유 ID 생성
            const buttonId = 'button-tag-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 9);
            
            // Button 태그 정보 저장
            // HTML 구조가 있으면 전체 Button 태그를 저장, 없으면 Button 태그 자체를 HTML로 저장
            buttonBlocks.push({
                id: buttonId,
                html: hasHtmlStructure && buttonContent.length > 10 ? fullButtonTag : fullButtonTag,
                hasHtmlStructure: hasHtmlStructure && buttonContent.length > 10
            });
            
            // ```html 코드 블록으로 감싸기 (Showdown이 변환하지 않도록)
            const codeBlock = `\`\`\`html\n${fullButtonTag}\n\`\`\``;
            
            // 정확한 위치에서 교체 (인덱스 기반)
            processedText = processedText.substring(0, matchIndex) + 
                           codeBlock + 
                           processedText.substring(matchIndex + fullButtonTag.length);
        }
        
        processedMatches.add(matchKey);
    }
    
    // HTML 코드 블록을 임시 마커로 변환
    // 주의: processedText에는 이미 addMessage에서 치환된 HTML 블록이 코드 블록 형태로 들어있음
    const processed = processHtmlCodeBlocks(processedText);
    const finalText = typeof processed === 'string' ? processed : processed.text;
    let htmlBlocks = typeof processed === 'object' && processed.htmlBlocks ? processed.htmlBlocks : [];
    
    
    // Button 태그 블록을 htmlBlocks에 추가
    htmlBlocks = htmlBlocks.concat(buttonBlocks);
    
    // HTML 블록의 {{user}}, {{char}} 매크로 치환 (iframe 렌더링 전)
    // substituteParams를 사용하여 모든 매크로 치환 (동기 함수이므로 import는 모듈 상단에서)
    if (htmlBlocks.length > 0) {
        htmlBlocks = htmlBlocks.map((block) => {
            let htmlContent = block.html;
            
            if (typeof htmlContent === 'string' && htmlContent.length > 0) {
                // substituteParams를 사용하여 모든 매크로 치환
                htmlContent = substituteParams(htmlContent, userName || '', charName || '');
                
                // 매크로가 남아있는 경우 경고
                if (htmlContent.includes('{{user}}') || htmlContent.includes('{{char}}')) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_CHAT_20002', 'HTML 블록 매크로 치환 실패');
                    }
                }
            }
            
            return {
                ...block,
                html: htmlContent
            };
        });
    }
    
    // 일반 텍스트 부분에도 {{user}}, {{char}} 매크로 치환 적용
    // HTML 블록은 이미 치환되었으므로, finalText (HTML 블록이 마커로 교체된 텍스트)에만 적용
    const finalTextWithMacros = substituteParams(finalText, userName || '', charName || '');
    
    // Showdown이 로드되어 있는지 확인
    if (typeof showdown === 'undefined') {
        // Showdown이 없으면 줄바꿈만 <p> 태그로 변환
        const lines = finalTextWithMacros.split('\n');
        if (lines.length === 0) return '';
        
        let html = lines.map(line => {
            if (line.trim() === '') {
                return '<p><br></p>';
            }
            // HTML 이스케이프
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            return `<p>${escaped}</p>`;
        }).join('');
        
        // HTML 블록 마커를 iframe으로 교체
        htmlBlocks.forEach(block => {
            const marker = `<!-- HTML_IFRAME_MARKER:${block.id} -->`;
            if (html.includes(marker)) {
                // HTML을 srcdoc에 안전하게 넣기 위해 이스케이프
                let safeSrcdoc = block.html
                    .replace(/&amp;/g, '&')  // 이미 이스케이프된 &amp;를 원래 &로
                    .replace(/&/g, '&amp;')  // 나머지 &를 &amp;로
                    .replace(/"/g, '&quot;') // 따옴표 이스케이프
                    .replace(/'/g, '&#39;'); // 작은따옴표도 이스케이프
                
                const iframeHtml = `<iframe id="${block.id}" class="message-html-iframe" srcdoc="${safeSrcdoc}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" scrolling="no" style="width: 100%; min-height: 50px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--border-radius-md); background: white; margin: var(--spacing-md) 0; display: block; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); overflow: hidden;"></iframe>`;
                html = html.replace(marker, iframeHtml);
            }
        });
        
        return html;
    }
    
    // Showdown을 사용한 마크다운 변환
    const converter = new showdown.Converter({
        emoji: true,
        literalMidWordUnderscores: true,
        parseImgDimensions: true,
        tables: true,
        simpleLineBreaks: true,
        strikethrough: true,
    });
    
    let html = converter.makeHtml(finalTextWithMacros);
    
        // HTML 블록 마커를 iframe으로 교체
        htmlBlocks.forEach(block => {
            const marker = `<!-- HTML_IFRAME_MARKER:${block.id} -->`;
            if (html.includes(marker)) {
                // HTML을 srcdoc에 안전하게 넣기 위해 이스케이프
                // srcdoc은 속성 값이므로 따옴표만 이스케이프하고, &는 나중에 처리
                let safeSrcdoc = block.html
                    .replace(/&amp;/g, '&')  // 이미 이스케이프된 &amp;를 원래 &로
                    .replace(/&/g, '&amp;')  // 나머지 &를 &amp;로
                    .replace(/"/g, '&quot;') // 따옴표 이스케이프
                    .replace(/'/g, '&#39;'); // 작은따옴표도 이스케이프
            
            const iframeHtml = `<iframe id="${block.id}" class="message-html-iframe" srcdoc="${safeSrcdoc}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" scrolling="no" style="width: 100%; min-height: 50px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--border-radius-md); background: white; margin: var(--spacing-md) 0; display: block; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); overflow: hidden;"></iframe>`;
            html = html.replace(marker, iframeHtml);
        }
    });
    
    // DOMPurify로 안전하게 정리 (있는 경우)
    // iframe은 DOMPurify에서 허용해야 함
    if (typeof DOMPurify !== 'undefined') {
        html = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'hr', 'iframe'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'width', 'height', 'id', 'sandbox', 'style', 'srcdoc', 'scrolling'],
        });
    }
    
    return html;
}

/**
 * ====================================================================================
 * ⚠️ 중요: 상호 의존성이 높은 기능들 관리 가이드
 * ====================================================================================
 * 
 * 이 클래스에는 서로 강하게 연결된 6가지 핵심 기능이 있습니다.
 * 하나를 수정할 때 다른 기능에 영향을 주지 않도록 반드시 다음 사항을 확인하세요.
 * 
 * [1] 정규식 (regexEngine.js)
 *     - 모든 메시지 렌더링 시 적용됨
 *     - loadChat, loadMoreMessagesFromStart, addMessage, saveEdit, cancelEdit에서 호출
 *     - 직접 편집: isEdit: true (runOnEdit이 true인 스크립트만 적용)
 *     - 형식 표시만: isMarkdown: true (markdownOnly가 true인 스크립트만 적용)
 *     - 형식 프롬프트만: isPrompt: true (promptOnly가 true인 스크립트만 적용)
 *     - Replace With 공백: 빈 문자열이면 매칭된 부분 삭제 (의도적 동작)
 *     - ⚠️ 중요: HTML 렌더링 제한보다 먼저 적용되지만, 렌더링 제한에 의해 플레이스홀더로 표시될 수 있음
 *     - 변경 시: 메시지 렌더링 로직에 영향
 * 
 * [2] 채팅 로드 수 제한 (messagesToLoad)
 *     - loadChat()에서 설정값 읽어서 최근 N개만 표시
 *     - startIndex 계산: if (chat.length > count) { startIndex = chat.length - count; }
 *     - 변경 시: 더보기 버튼 표시 여부에 영향
 * 
 * [3] 더보기 기능 (loadMoreMessagesFromStart)
 *     - loadChat에서 startIndex > 0이면 더보기 버튼 추가
 *     - 더보기 클릭 시: startIndex부터 이전 messagesToLoad개 로드
 *     - 변경 시: loadChat의 startIndex 계산과 연동되어야 함
 * 
 * [4] HTML 렌더링 제한 (htmlRenderLimit)
 *     - loadChat, loadMoreMessagesFromStart, saveEdit, cancelEdit 모두에서 적용
 *     - 역순 인덱스 기준으로 최근 N개만 렌더링, 나머지는 플레이스홀더
 *     - ⚠️ 중요: 정규식보다 우선 적용됨 (정규식은 먼저 적용되지만 렌더링 제한에 의해 플레이스홀더로 표시)
 *     - 정규식이 적용된 HTML 콘텐츠도 렌더링 제한에 따라 플레이스홀더로 표시됨
 *     - 변경 시: 모든 메시지 렌더링 함수에서 정규식 적용 후 HTML 렌더링 제한 적용 순서 유지
 * 
 * [5] 채팅 파일 불러오기 (importChat in utils/import.js)
 *     - 불러온 채팅은 imported_date를 lastMessageDate로 설정하여 최신순 정렬
 *     - loadChat() 호출 후 character.chat 업데이트 필수 (불러온 채팅이 가장 최근이 되도록)
 *     - 변경 시: loadOrCreateChat의 정렬 로직과 연동 확인
 * 
 * [6] 가장 최근 채팅 불러오기 / 새 채팅 생성 (loadOrCreateChat)
 *     - character.chat을 우선 찾고, 없으면 imported_date 기준 최신순 정렬 후 가장 최근 채팅 사용
 *     - 채팅이 없으면 createNewChat() 호출
 *     - 변경 시: importChat의 character.chat 업데이트와 연동 확인
 * 
 * ⚠️ 수정 시 체크리스트:
 * 1. loadChat 수정 시 → 더보기 버튼 표시 로직, htmlRenderLimit 적용 확인
 *    * 정규식 적용 후 HTML 렌더링 제한 적용 순서 유지
 * 2. loadMoreMessagesFromStart 수정 시 → loadChat의 startIndex 계산과 일치 확인
 *    * 정규식 적용 후 HTML 렌더링 제한 적용 순서 유지
 * 3. saveEdit 수정 시 → 정규식 적용(isEdit: true) 후 HTML 렌더링 제한 적용 확인
 * 4. cancelEdit 수정 시 → 정규식 적용(isMarkdown: true) 후 HTML 렌더링 제한 적용 확인
 * 5. importChat 수정 시 → loadChat에서 character.chat 업데이트 확인
 * 6. loadOrCreateChat 수정 시 → imported_date 정렬 로직 확인
 * 7. saveChat 수정 시 → DOM 메시지와 저장소 메시지 병합 로직 확인
 * 
 * ====================================================================================
 */

class ChatManager {
    constructor(elements) {
        this.elements = elements;
        // 메시지 입력창 이벤트 리스너 저장 (제거를 위해)
        this._messageInputKeydownHandler = null;
        this._messageInputInputHandler = null;
        this._messageInputBlurHandler = null;
        this.abortController = null;
        this.isGenerating = false;
        this.currentChatId = null;
        this.currentChatName = null;
        this.currentCharacterId = null;
        this.chatCreateDate = Date.now();
        this.saveChatDebounceTimer = null;
        this._isSavingChat = false; // 중복 저장 방지 플래그
        // 실리태번과 동일: chat 배열로 메시지 관리 (인덱스 0부터 시작)
        this.chat = [];
        this.chat_metadata = {}; // 실리태번과 동일: chat_metadata
        this._messageDeletedRecently = false; // 메시지가 최근에 삭제되었는지 추적 (그리팅 추가 방지용)
        this._deletedMessageUuids = new Set(); // 삭제된 메시지 UUID 추적 (regenerateMessage, deleteMessage 등)
        this.setupEventListeners();
        this.setupAutofillButton();
        this.aiLoader = document.getElementById('ai-loader');
        
        // 초기 전송 버튼 상태 설정
        requestAnimationFrame(() => {
            this.updateSendButtonState();
        });
    }
    
    /**
     * AI 로더 표시/숨김
     * @param {boolean} show - 표시 여부
     * @param {boolean} generationSuccess - 생성 성공 여부 (show가 false일 때만 사용, 효과음 재생용)
     */
    async showAILoader(show, generationSuccess = false) {
        // show = false일 때는 즉시 실행 (백그라운드 탭에서도 작동)
        if (!show) {
            // 로더 숨김 (즉시 실행, await 없이)
            if (!this.aiLoader) {
                this.aiLoader = document.getElementById('ai-loader');
            }
            
            if (this.aiLoader) {
                this.aiLoader.classList.add('hidden');
            }
            
            // AI 응답 완료 시 효과음 재생 (정상 완료 시에만, 실리태번과 동일)
            // AI 로더가 사라지는 타이밍과 같음
            // 비동기로 실행하여 UI 업데이트를 블로킹하지 않음
            if (generationSuccess) {
                // playMessageSound - 전역 스코프에서 사용
                // await 없이 비동기로 실행 (탭 포커스와 관계없이 UI는 즉시 업데이트됨)
                if (typeof playMessageSound === 'function') {
                    playMessageSound().catch((error) => {
                        console.debug('[showAILoader] 효과음 재생 중 오류 (무시):', error);
                    });
                }
            }
            
            // CSS는 유지 (다른 곳에서 사용할 수도 있으므로)
            return; // 즉시 반환하여 UI 업데이트를 블로킹하지 않음
        }
        
        // show = true일 때만 비동기 작업 수행
        // AILoadingStorage - 전역 스코프에서 사용
        const enabled = await AILoadingStorage.loadEnabled();
        
        if (!enabled) {
            return; // 토글이 꺼져있으면 로더 표시 안 함
        }
        
        if (!this.aiLoader) {
            this.aiLoader = document.getElementById('ai-loader');
        }
        
        if (!this.aiLoader) {
            return;
        }
        
        if (show) {
            // 현재 선택된 프리셋 로드
            const currentPresetId = await AILoadingStorage.loadCurrentPresetId();
            let html = '';
            let css = '';
            
            if (currentPresetId) {
                const preset = await AILoadingStorage.loadPreset(currentPresetId);
                if (preset) {
                    html = preset.html || '';
                    css = preset.css || '';
                }
            }
            
            // 기본값 사용 (프리셋이 없거나 HTML/CSS가 비어있는 경우)
            if (!html && !css) {
                html = `<div class="ai-loader-content">
    <div class="ai-loader-spinner">
        <i class="fa-solid fa-gear fa-spin"></i>
    </div>
</div>`;
                css = `.ai-loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.ai-loader-spinner {
    font-size: 48px;
    color: var(--accent-green);
    animation: spin 2s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}`;
            }
            
            // 매크로 치환: {{char}}, {{user}}
            // substituteParams - 전역 스코프에서 사용
            // CharacterStorage - 전역 스코프에서 사용
            // UserPersonaStorage - 전역 스코프에서 사용
            
            // 현재 선택된 캐릭터와 페르소나 정보 가져오기
            let charName = '';
            let userName = '';
            
            try {
                const currentCharacterId = await CharacterStorage.loadCurrent();
                if (currentCharacterId) {
                    const character = await CharacterStorage.load(currentCharacterId);
                    if (character?.data?.name || character?.name) {
                        charName = character.data?.name || character.name;
                    }
                }
            } catch (error) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20003', '캐릭터 정보 로드 실패', error);
                }
            }
            
            try {
                const settings = await SettingsStorage.load();
                const currentPersonaId = settings.currentPersonaId;
                if (currentPersonaId) {
                    const persona = await UserPersonaStorage.load(currentPersonaId);
                    if (persona?.name) {
                        userName = persona.name;
                    }
                }
            } catch (error) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20004', '페르소나 정보 로드 실패', error);
                }
            }
            
            // HTML에 매크로 치환 적용
            html = substituteParams(html, userName, charName);
            
            // 기존 스타일 제거 (프리셋이 바뀌었을 수 있으므로)
            const existingStyle = document.getElementById('ai-loader-custom-style');
            if (existingStyle) {
                existingStyle.remove();
            }
            
            // CSS 동적 적용
            if (css) {
                const style = document.createElement('style');
                style.id = 'ai-loader-custom-style';
                style.textContent = css;
                document.head.appendChild(style);
            }
            
            // 사용자 HTML을 중앙 배치 div로 감싸기
            const wrapper = document.createElement('div');
            wrapper.className = 'ai-loader-wrapper';
            wrapper.innerHTML = html;
            
            // 기존 내용 제거 후 새 내용 추가
            this.aiLoader.innerHTML = '';
            this.aiLoader.appendChild(wrapper);
            
            this.aiLoader.classList.remove('hidden');
        }
    }
    
    /**
     * 요소 내의 HTML iframe을 초기화 (높이 자동 조절)
     * @param {HTMLElement} element - 변환할 요소
     * @param {boolean} skipRender - 렌더링을 건너뛸지 여부 (성능 최적화용)
     */
    renderHtmlIframesInElement(element, skipRender = false) {
        if (!element) return;
        
        // 성능 최적화: skipRender가 true이면 iframe 렌더링 건너뛰기
        if (skipRender) {
            // iframe을 플레이스홀더로 교체
            const iframes = element.querySelectorAll('.message-html-iframe');
            iframes.forEach(iframe => {
                // 이미 플레이스홀더로 교체되었는지 확인
                if (iframe.parentNode) {
                    // iframe의 srcdoc을 data 속성에 저장하여 나중에 복원할 수 있도록 함
                    if (iframe.srcdoc && !iframe.dataset.originalSrcdoc) {
                        iframe.dataset.originalSrcdoc = iframe.srcdoc;
                    }
                    
                    // skipRender=true일 때는 무조건 플레이스홀더로 교체
                    // htmlRenderLimit 설정으로 인해 최근 N개가 아닌 메시지는 렌더링하지 않음
                    const placeholder = document.createElement('div');
                    placeholder.className = 'html-placeholder';
                    placeholder.style.cssText = 'padding: 10px; border: 1px dashed rgba(255,255,255,0.3); border-radius: 4px; margin: 10px 0; color: rgba(255,255,255,0.6); font-size: 0.9em; text-align: center;';
                    placeholder.textContent = '[HTML 콘텐츠 - 최근 메시지만 렌더링됨]';
                    // 원본 srcdoc 저장 (복원용)
                    if (iframe.dataset.originalSrcdoc) {
                        placeholder.dataset.originalSrcdoc = iframe.dataset.originalSrcdoc;
                    }
                    
                    iframe.parentNode.replaceChild(placeholder, iframe);
                }
            });
            return;
        }
        
        // skipRender=false일 때: 플레이스홀더를 iframe으로 복원하거나 iframe을 렌더링
        const placeholders = element.querySelectorAll('.html-placeholder');
        placeholders.forEach(placeholder => {
            // 플레이스홀더에 저장된 원본 srcdoc이 있으면 iframe으로 복원
            if (placeholder.dataset.originalSrcdoc) {
                const iframe = document.createElement('iframe');
                iframe.className = 'message-html-iframe';
                iframe.srcdoc = placeholder.dataset.originalSrcdoc;
                iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
                iframe.scrolling = 'no';
                iframe.style.cssText = 'width: 100%; min-height: 50px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--border-radius-md); background: white; margin: var(--spacing-md) 0; display: block; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); overflow: hidden;';
                
                if (placeholder.parentNode) {
                    placeholder.parentNode.replaceChild(iframe, placeholder);
                }
            }
        });
        
        // 모든 iframe 요소 찾기 (복원된 것 포함)
        const iframes = element.querySelectorAll('.message-html-iframe');
        
        iframes.forEach(iframe => {
            // iframe이 실제로 렌더링되었음을 표시
            iframe.setAttribute('data-iframe-rendered', 'true');
            
            // srcdoc이나 src가 있는 iframe만 높이 조절 (messageFormatting에서 생성된 iframe)
            if (iframe.srcdoc || iframe.src) {
                let resizeObserver = null;
                let mutationObserver = null;
                
                // iframe 높이 조절 함수 - html 높이를 직접 사용
                const adjustHeight = () => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc && iframeDoc.documentElement) {
                            const html = iframeDoc.documentElement;
                            const body = iframeDoc.body;
                            
                            // offsetHeight를 우선 사용 (줄어들 때도 정확함)
                            // 없으면 scrollHeight 사용
                            const htmlOffsetHeight = html.offsetHeight || 0;
                            const htmlScrollHeight = html.scrollHeight || 0;
                            const bodyScrollHeight = body ? (body.scrollHeight || 0) : 0;
                            
                            // offsetHeight가 있으면 우선 사용, 없으면 scrollHeight 중 큰 값 사용
                            let htmlHeight = htmlOffsetHeight > 0 ? htmlOffsetHeight : Math.max(htmlScrollHeight, bodyScrollHeight, 50);
                            
                            // iframe 높이를 html 높이와 항상 동일하게 설정 (줄어들든 늘어나든)
                            if (iframe.style.height !== htmlHeight + 'px') {
                                iframe.style.height = htmlHeight + 'px';
                            }
                            
                            // iframe 내부 스크롤 제거
                            if (html.style) {
                                html.style.overflow = 'hidden';
                            }
                            if (body && body.style) {
                                body.style.overflow = 'hidden';
                            }
                        }
                    } catch (e) {
                        // Cross-origin 오류 처리
                        // 경고 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('WARN_CHAT_20005', 'iframe 높이 조절 실패', e);
                        }
                    }
                };
                
                // iframe 로드 완료 후 높이 조절 및 감시 시작
                const initializeHeight = () => {
                    // 초기 높이 설정
                    adjustHeight();
                    
                    // ResizeObserver로 iframe 내부 body 크기 변경 감지
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc && iframeDoc.body) {
                            // ResizeObserver로 html 크기 변경 감지
                            if (typeof ResizeObserver !== 'undefined') {
                                resizeObserver = new ResizeObserver(() => {
                                    adjustHeight(); // debounce 제거, 즉시 실행
                                });
                                resizeObserver.observe(iframeDoc.documentElement);
                            }
                            
                            // MutationObserver로 DOM 변경 감지
                            mutationObserver = new MutationObserver(() => {
                                adjustHeight(); // debounce 제거, 즉시 실행
                            });
                            mutationObserver.observe(iframeDoc.documentElement, {
                                childList: true,
                                subtree: true,
                                attributes: true,
                                attributeFilter: ['style', 'class']
                            });
                            
                            // iframe 내부 리사이즈 이벤트 감지
                            if (iframe.contentWindow) {
                                iframe.contentWindow.addEventListener('resize', () => {
                                    adjustHeight(); // debounce 제거, 즉시 실행
                                });
                            }
                            
                            // 주기적으로 체크 (더 자주 체크)
                            const checkInterval = setInterval(() => {
                                try {
                                    if (iframeDoc.documentElement && iframe.contentWindow) {
                                        adjustHeight();
                                    } else {
                                        clearInterval(checkInterval);
                                    }
                                } catch (e) {
                                    clearInterval(checkInterval);
                                }
                            }, 100); // 100ms마다 체크
                            
                            // iframe 제거 시 interval 정리
                            iframe._checkInterval = checkInterval;
                        } else {
                            // 경고 코드 토스트 알림 표시
                            if (typeof showErrorCodeToast === 'function') {
                                showErrorCodeToast('WARN_CHAT_20006', 'iframeDoc 또는 body가 없습니다');
                            }
                        }
                    } catch (e) {
                        // 경고 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('WARN_CHAT_20007', 'iframe 감시 설정 실패', e);
                        }
                    }
                };
                
                // 이미 로드되었을 수도 있으므로 즉시 시도
                if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                    initializeHeight();
                } else {
                    // 아직 로드되지 않았으면 onload 이벤트 대기
                    iframe.onload = () => {
                        initializeHeight();
                    };
                    
                    // onload가 발생하지 않을 수 있으므로 짧은 지연 후에도 시도
                    setTimeout(() => {
                        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                            initializeHeight();
                        }
                    }, 100);
                }
                
                // iframe이 제거될 때 observer 정리
                const cleanup = () => {
                    if (resizeObserver) {
                        resizeObserver.disconnect();
                        resizeObserver = null;
                    }
                    if (mutationObserver) {
                        mutationObserver.disconnect();
                        mutationObserver = null;
                    }
                    if (iframe._checkInterval) {
                        clearInterval(iframe._checkInterval);
                        delete iframe._checkInterval;
                    }
                    // timeout들 정리 (cleanup 함수 내부에서 접근 가능하도록)
                    if (resizeTimeout !== null) {
                        clearTimeout(resizeTimeout);
                        resizeTimeout = null;
                    }
                    if (mutationTimeout !== null) {
                        clearTimeout(mutationTimeout);
                        mutationTimeout = null;
                    }
                    if (windowResizeTimeout !== null) {
                        clearTimeout(windowResizeTimeout);
                        windowResizeTimeout = null;
                    }
                };
                
                // 메모리 누수 방지를 위한 정리 함수 저장
                iframe._cleanupObservers = cleanup;
            }
        });
    }
    
    /**
     * iframe만 있을 때 message-content와 message-wrapper에 클래스 추가/제거
     * @param {HTMLElement} messageWrapper - message-wrapper 요소 (선택적)
     * @param {HTMLElement} content - message-content 요소
     * @param {HTMLElement} messageText - message-text 요소
     */

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 메시지 전송
        this.elements.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // 메시지 전송 키보드 단축키 설정 (높이 자동 조절 포함)
        this.setupMessageInputKeydown();
    }

    /**
     * 메시지 입력창 키보드 이벤트 설정
     * 설정에 따라 Enter 또는 Ctrl+Enter로 전송
     */
    setupMessageInputKeydown() {
        // SettingsStorage - 전역 스코프에서 사용
        SettingsStorage.load().then(settings => {
            const messageSendKey = settings.message_send_key || 'enter';
            
            // 기존 이벤트 리스너 제거
            if (this._messageInputKeydownHandler) {
                this.elements.messageInput.removeEventListener('keydown', this._messageInputKeydownHandler);
            }
            if (this._messageInputInputHandler) {
                this.elements.messageInput.removeEventListener('input', this._messageInputInputHandler);
            }
            if (this._messageInputBlurHandler) {
                this.elements.messageInput.removeEventListener('blur', this._messageInputBlurHandler);
            }
            
            // 높이 자동 조절 함수 (전역 함수 재사용 또는 새로 생성)
            const adjustHeight = typeof window !== 'undefined' && window.messageInputHeightAdjust 
                ? window.messageInputHeightAdjust 
                : () => {
                    const value = this.elements.messageInput.value || '';
                    
                    // 빈 내용이면 최소 높이로 고정
                    if (value.trim() === '') {
                        this.elements.messageInput.style.height = '44px';
                        this.elements.messageInput.style.overflowY = 'hidden';
                        return;
                    }
                    
                    // 줄바꿈이 없는 한 줄인지 확인
                    const hasNewline = value.includes('\n');
                    
                    // 최소/최대 높이
                    const minHeight = 44;
                    const maxHeight = window.innerHeight * 0.4; // 40vh
                    
                    // 한 줄이면 무조건 최소 높이로 고정 (여백 방지)
                    if (!hasNewline) {
                        this.elements.messageInput.style.height = `${minHeight}px`;
                        this.elements.messageInput.style.overflowY = 'hidden';
                        return;
                    }
                    
                    // 여러 줄인 경우에만 scrollHeight 측정
                    // iOS Safari 호환: height를 1px로 리셋하여 강제 리플로우 유발
                    const originalHeight = this.elements.messageInput.style.height;
                    this.elements.messageInput.style.height = '1px';
                    
                    // scrollHeight 측정 (iOS Safari에서 정확한 측정을 위해)
                    const scrollHeight = this.elements.messageInput.scrollHeight;
                    
                    // 최소/최대 높이 적용
                    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
                    
                    // 높이 설정
                    this.elements.messageInput.style.height = `${newHeight}px`;
                    
                    // 최대 높이에 도달하면 스크롤 가능하도록
                    if (scrollHeight > maxHeight) {
                        this.elements.messageInput.style.overflowY = 'auto';
                    } else {
                        this.elements.messageInput.style.overflowY = 'hidden';
                    }
                };
            
            // CSS 스타일 설정 (높이 자동 조절을 위해)
            this.elements.messageInput.style.resize = 'none';
            this.elements.messageInput.style.overflow = 'hidden';
            this.elements.messageInput.style.minHeight = '44px';
            this.elements.messageInput.style.maxHeight = '40vh';
            this.elements.messageInput.style.maxHeight = '40dvh';
            
            // 초기 높이 설정
            adjustHeight();
            
            // 키보드 이벤트 핸들러
            this._messageInputKeydownHandler = (e) => {
                if (messageSendKey === 'enter') {
                    // Enter 키로 전송 (Shift+Enter는 줄꿈)
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                } else if (messageSendKey === 'ctrl_enter') {
                    // Ctrl+Enter 키로 전송 (Enter는 줄꿈)
                    if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                }
            };
            
            // 입력 이벤트 핸들러
            this._messageInputInputHandler = () => {
                // 높이 자동 조절
                adjustHeight();
                
                // 전송 버튼 상태 업데이트
                if (!this.isGenerating) {
                    this.updateSendButtonState();
                }
            };
            
            // iOS에서 blur 시 키보드가 올라온 상태의 window.innerHeight로 계산되어 
            // 높이가 과도하게 줄어드는 문제를 방지하기 위해 blur 이벤트 제거
            // CSS의 max-height: 40dvh가 제한을 담당함
            // 블러 이벤트 핸들러 제거
            // this._messageInputBlurHandler = adjustHeight;
            
            // 새로운 이벤트 리스너 추가
            this.elements.messageInput.addEventListener('keydown', this._messageInputKeydownHandler);
            this.elements.messageInput.addEventListener('input', this._messageInputInputHandler);
            // blur 이벤트 제거: iOS에서 키보드가 올라온 상태에서 blur 시 높이가 과도하게 줄어드는 문제 방지
            // this.elements.messageInput.addEventListener('blur', this._messageInputBlurHandler);
        });
    }

    /**
     * 전송 버튼 상태 업데이트
     * 생성 중이 아닐 때는 항상 활성화
     * (메시지가 0개면 프롬프트만 전송, 입력창이 비어있으면 마지막 메시지 재전송/continue)
     * 생성 중일 때는 버튼이 정지 버튼이므로 항상 활성화
     */
    updateSendButtonState() {
        // 생성 중이든 아니든 항상 활성화
        this.elements.sendBtn.disabled = false;
        
        // 아이콘 상태 업데이트 (isGenerating 플래그를 직접 확인하여 즉시 반영)
        if (this.isGenerating) {
            // 생성 중: 정지 버튼
            this.updateSendButtonIcon('stop');
        } else {
            // 생성 중 아님: 입력창 텍스트와 마지막 메시지 타입에 따라 아이콘 결정
            // getChatHistory는 동기 함수이지만 DOM 접근이므로 백그라운드에서도 즉시 실행됨
            const hasText = this.elements.messageInput.value.trim().length > 0;
            const chatHistory = this.getChatHistory();
            const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
            
            if (!hasText && lastMessage && lastMessage.role === 'assistant') {
                // 입력창이 비어있고 마지막 메시지가 캐릭터 메시지: 빨리감기 아이콘 (continue)
                this.updateSendButtonIcon('forward');
            } else {
                // 입력창에 텍스트가 있거나 그 외: 재생 아이콘
                this.updateSendButtonIcon('play');
            }
        }
    }

    /**
     * 대필 버튼 이벤트 설정
     */
    setupAutofillButton() {
        const autofillBtn = document.getElementById('autofill-btn');
        if (!autofillBtn) return;

        // 대필 버튼 참조 저장
        this.elements.autofillBtn = autofillBtn;

        autofillBtn.addEventListener('click', () => {
            if (this.isGenerating) {
                return; // 생성 중이면 클릭 무시
            }
            this.openAutofillModal();
        });

        // 초기 상태 설정 (약간의 지연을 주어 DOM이 준비된 후 설정)
        setTimeout(() => {
            this.updateAutofillButtonState();
        }, 100);
    }

    /**
     * 대필 버튼 상태 업데이트
     */
    updateAutofillButtonState() {
        const autofillBtn = this.elements.autofillBtn || document.getElementById('autofill-btn');
        if (!autofillBtn) return;

        autofillBtn.disabled = this.isGenerating;
    }

    /**
     * 대필 모달 열기
     * @param {string} [initialText] - 모달 인풋에 미리 채울 텍스트
     * @param {Object} [options] - 옵션 객체
     * @param {boolean} [options.inputOnly=false] - true이면 사용자 입력값만 반환하고 대필 실행 안 함
     * @param {string} [options.okButton] - 확인 버튼 텍스트
     * @param {string} [options.cancelButton] - 취소 버튼 텍스트
     * @param {string} [options.message] - 모달 메시지
     * @returns {Promise<string|null>} inputOnly가 true이면 사용자 입력값 반환, false이면 undefined
     */
    /**
     * 대필 모달 닫기 (애니메이션 포함)
     * @param {HTMLElement} modalContainer - 모달 컨테이너 요소
     */
    closeAutofillModal(modalContainer) {
        if (!modalContainer) return;
        
        // 이미 닫히는 중이면 무시
        if (modalContainer.classList.contains('closing')) {
            return;
        }
        
        // 닫기 애니메이션 추가
        modalContainer.classList.add('closing');
        const overlay = document.getElementById('overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('closing');
        }
        
        // 즉시 클릭 방지 (애니메이션 중에도)
        modalContainer.style.pointerEvents = 'none';
        if (overlay) {
            overlay.style.pointerEvents = 'none';
        }
        
        // 다른 모달이 열려있는지 확인
        const panelContainer = document.getElementById('panel-modal-container');
        const settingsModal = document.getElementById('settings-modal');
        const sideMenu = document.getElementById('side-menu');
        const settingsModalOpen = settingsModal && !settingsModal.classList.contains('hidden');
        const sideMenuOpen = sideMenu && !sideMenu.classList.contains('hidden');
        
        // 정리 함수
        const cleanup = () => {
            modalContainer.remove();
            
            if (overlay && !overlay.classList.contains('hidden')) {
                if (!panelContainer && !settingsModalOpen && !sideMenuOpen) {
                    // 다른 모달이 없으면 오버레이 숨김
                    overlay.classList.remove('closing');
                    overlay.classList.add('hidden');
                    overlay.style.pointerEvents = 'none';
                } else {
                    // 다른 모달이 있으면 오버레이 유지
                    overlay.classList.remove('closing');
                    overlay.style.pointerEvents = '';
                }
            }
        };
        
        // 애니메이션 완료 이벤트 리스너
        let animationHandled = false;
        const handleAnimationEnd = () => {
            if (animationHandled) return;
            animationHandled = true;
            
            modalContainer.removeEventListener('animationend', handleAnimationEnd);
            cleanup();
        };
        
        modalContainer.addEventListener('animationend', handleAnimationEnd);
        
        // 타임아웃으로 강제 정리 (최대 500ms 후)
        setTimeout(() => {
            if (!animationHandled) {
                animationHandled = true;
                modalContainer.removeEventListener('animationend', handleAnimationEnd);
                cleanup();
            }
        }, 500);
    }

    async openAutofillModal(initialText = '', options = {}) {
        const { inputOnly = false, okButton, cancelButton, message } = options;
        // createAutofillModal, setupAutofillModalEvents - 전역 스코프에서 사용
        
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('autofill-modal-container');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 생성 (비동기 함수이므로 await 필요)
        const modalContainer = document.createElement('div');
        modalContainer.id = 'autofill-modal-container';
        modalContainer.className = 'modal hidden'; // 처음에는 hidden으로 시작
        modalContainer.innerHTML = await createAutofillModal();
        document.body.appendChild(modalContainer);

        // 오버레이 표시 (다른 모달이 이미 열려있을 수 있으므로 먼저 확인)
        const overlay = document.getElementById('overlay');
        if (overlay) {
            // 오버레이가 이미 표시되어 있으면 closing 클래스만 제거
            if (!overlay.classList.contains('hidden')) {
                overlay.classList.remove('closing');
            } else {
                // 오버레이가 숨겨져 있으면 표시
                overlay.classList.remove('closing', 'hidden');
            }
            overlay.style.pointerEvents = '';
        }

        // 모달 애니메이션을 위해 requestAnimationFrame 사용
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modalContainer.classList.remove('hidden');
                
                // 모달이 표시된 후 textarea에 자동 focus
                const contentInput = modalContainer.querySelector('#autofill-content-input');
                if (contentInput) {
                    // 약간의 지연 후 focus (애니메이션 완료 대기)
                    setTimeout(() => {
                        contentInput.focus();
                    }, 100);
                }
            });
        });

        // 모달 컨테이너 클릭 시 닫기 (모달 내용 클릭은 무시)
        const closeModalOnOutsideClick = () => {
            this.closeAutofillModal(modalContainer);
        };
        
        modalContainer.addEventListener('click', (e) => {
            // 모달 내용 클릭은 무시
            if (e.target.closest('.modal-content')) {
                return;
            }
            // 모달 배경 클릭 시 닫기
            closeModalOnOutsideClick();
        });

        // inputOnly 모드인 경우 Promise로 사용자 입력값 반환
        if (inputOnly) {
            return new Promise((resolve) => {
                let resolved = false;
                const closeModal = () => {
                    if (resolved) return;
                    resolved = true;
                    this.closeAutofillModal(modalContainer);
                };

                // 이벤트 설정
                setupAutofillModalEvents(
                    modalContainer,
                    async (finalPrompt, content) => {
                        // inputOnly 모드에서는 대필 실행 안 함
                        closeModal();
                        resolve(content); // 사용자 입력값 반환
                    },
                    () => {
                        // 취소 버튼 클릭 시
                        closeModal();
                        resolve(null); // null 반환 (실리태번과 동일)
                    }
                ).then(() => {
                    // 버튼 텍스트 커스터마이징 (이벤트 설정 후)
                    if (okButton || cancelButton) {
                        const submitBtn = modalContainer.querySelector('#autofill-submit-btn');
                        const cancelBtn = modalContainer.querySelector('#autofill-cancel-btn');
                        if (okButton && submitBtn) {
                            submitBtn.textContent = okButton;
                        }
                        if (cancelButton && cancelBtn) {
                            cancelBtn.textContent = cancelButton;
                        }
                    }
                    
                    // 초기 텍스트 설정
                    if (initialText) {
                        const contentInput = modalContainer.querySelector('#autofill-content-input');
                        if (contentInput) {
                            contentInput.value = initialText;
                            contentInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                }).catch((error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_CHAT_3002', '모달 설정 중 오류가 발생했습니다', error);
                    }
                    closeModal();
                    resolve(null);
                });
            });
        } else {
            // 기존 모드: 대필 실행
            // 이벤트 설정 (비동기 함수이므로 await 필요)
            await setupAutofillModalEvents(
                modalContainer,
                async (finalPrompt, content) => {
                    // 대필 실행 (모달은 setupAutofillModalEvents에서 닫음)
                    await this.executeAutofill(finalPrompt);
                },
                () => {
                    this.closeAutofillModal(modalContainer);
                }
            );
            
            // 버튼 텍스트 커스터마이징 (이벤트 설정 후)
            if (okButton || cancelButton) {
                const submitBtn = modalContainer.querySelector('#autofill-submit-btn');
                const cancelBtn = modalContainer.querySelector('#autofill-cancel-btn');
                if (okButton && submitBtn) {
                    submitBtn.textContent = okButton;
                }
                if (cancelButton && cancelBtn) {
                    cancelBtn.textContent = cancelButton;
                }
            }
            
            // 초기 텍스트 설정 (모달이 열린 후)
            if (initialText) {
                const contentInput = modalContainer.querySelector('#autofill-content-input');
                if (contentInput) {
                    contentInput.value = initialText;
                    // 텍스트 입력 시 높이 자동 조절을 위해 input 이벤트 발생
                    contentInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    }

    /**
     * 대필 실행
     * @param {string} prompt - 대필 지시문 ({{대필내용}}이 이미 치환된 상태)
     */
    async executeAutofill(prompt) {
        // 생성 중이면 중단
        if (this.isGenerating) {
            showToast('이미 생성 중입니다. 완료 후 다시 시도해주세요.', 'warning');
            return;
        }

        let autofillSuccess = false; // finally 블록에서 접근 가능하도록 try 블록 밖에서 선언
        try {
            // AbortController 생성 및 버튼 상태 변경
            this.abortController = new AbortController();
            this.isGenerating = true;
            this.updateSendButtonIcon('stop');
            this.updateAutofillButtonState(); // 대필 버튼 비활성화
            // 생성 중이므로 버튼 상태 업데이트 (정지 버튼으로 활성화)
            this.updateSendButtonState();
            await this.showAILoader(true); // AI 로더 표시

            // AI 응답 생성 (일반 메시지 전송과 동일한 프롬프트 사용)
            const responseText = await this.generateAIResponseForAutofill(prompt);
            // AI 응답을 message-input에 입력 (실리태번 impersonate와 동일)
            if (responseText && responseText.trim()) {
                const trimmedResponse = responseText.trim();
                this.elements.messageInput.value = trimmedResponse;
                this.elements.messageInput.dispatchEvent(new Event('input', { bubbles: true }));

                // 입력창 높이 조정
                this.elements.messageInput.style.height = 'auto';
                this.elements.messageInput.style.height = `${this.elements.messageInput.scrollHeight}px`;
                
                // 텍스트 끝으로 스크롤 (textarea인 경우)
                if (this.elements.messageInput.tagName === 'TEXTAREA') {
                    // DOM 업데이트 대기
                    await new Promise(resolve => requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // 텍스트 끝으로 스크롤
                            this.elements.messageInput.scrollTop = this.elements.messageInput.scrollHeight;
                            // 포커스해서 입력창이 보이도록
                            this.elements.messageInput.focus();
                            resolve();
                        });
                    }));
                } else {
                    // input인 경우 포커스만
                    this.elements.messageInput.focus();
                    // 텍스트 끝으로 커서 이동
                    this.elements.messageInput.setSelectionRange(trimmedResponse.length, trimmedResponse.length);
                }
                
                // 전송 버튼 활성화
                this.elements.sendBtn.disabled = false;
                
                autofillSuccess = true; // 정상 완료
            } else {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20008', '대필 실행 시 AI 응답이 비어있습니다');
                } else if (typeof showToast === 'function') {
                    showToast('AI 응답이 비어있습니다.', 'warning');
                }
            }

        } catch (error) {
            // AbortError 또는 사용자 정지 버튼 클릭은 정상적인 중단이므로 에러 메시지 표시하지 않음
            if (error.name === 'AbortError' || 
                error.message === '요청이 취소되었습니다.' ||
                error.message === 'User clicked stop button' ||
                (error instanceof Error && error.message.includes('abort'))) {
                return;
            }
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3003', '대필 실행 중 오류가 발생했습니다', error);
            } else if (typeof showToast === 'function') {
                showToast(`대필 실행 중 오류가 발생했습니다: ${error.message}`, 'error');
            } else {
                alert('대필 실행 중 오류가 발생했습니다: ' + error.message);
            }
        } finally {
            // 백그라운드 탭에서도 즉시 반영되도록 최우선으로 UI 업데이트
            // 1. 플래그 즉시 설정
            this.abortController = null;
            this.isGenerating = false;
            
            // 2. 버튼 아이콘 직접 변경 (DOM 조작, 동기적 즉시 실행)
            const icon = document.getElementById('send-btn-icon');
            if (icon) {
                icon.className = 'fa-solid fa-play';
                if (this.elements.sendBtn) {
                    this.elements.sendBtn.classList.remove('generating');
                }
            }
            
            // 3. AI 로더 직접 숨김 (DOM 조작, 동기적 즉시 실행)
            if (!this.aiLoader) {
                this.aiLoader = document.getElementById('ai-loader');
            }
            if (this.aiLoader) {
                this.aiLoader.classList.add('hidden');
            }
            
            // 4. 대필 버튼 상태 업데이트
            this.updateAutofillButtonState();
            
            // 5. 효과음 재생 (비동기, await 없이)
            if (autofillSuccess && typeof playMessageSound === 'function') {
                playMessageSound().catch((error) => {
                    console.debug('[executeAutofill] 효과음 재생 중 오류 (무시):', error);
                });
            }
            
            // 6. 정확한 버튼 상태 업데이트 (나중에 실행)
            Promise.resolve().then(() => {
                this.updateSendButtonState();
            }).catch((error) => {
                console.debug('[executeAutofill] updateSendButtonState 중 오류 (무시):', error);
            });
        }
    }

    /**
     * 대필용 AI 응답 생성
     * ⚠️ 이 함수는 autofillSender.js로 이동되었습니다.
     * 관련 요청사항이 있기 전까지 이 함수를 수정하지 마세요.
     * @param {string} userMessage - 대필 지시문이 포함된 사용자 메시지
     * @returns {Promise<string>} AI 응답 텍스트
     */
    async generateAIResponseForAutofill(userMessage) {
        // ⚠️ 핵심 로직은 autofillSender.js로 이동되었습니다.
        // 관련 요청사항이 있기 전까지 이 함수를 수정하지 마세요.
        // sendAIMessageForAutofill - 전역 스코프에서 사용
        return await sendAIMessageForAutofill(userMessage, this);
    }

    /**
     * 요청 중단
     */
    async abortGeneration() {
        if (this.abortController && this.isGenerating) {
            
            // AbortSignal 전송 (이유 없이 호출하면 기본 AbortError 발생)
            // reason을 전달하면 그 값이 AbortSignal의 reason이 되고, AbortError의 message가 됨
            if (this.abortController && !this.abortController.signal.aborted) {
                this.abortController.abort();
            }
            
            // 상태 초기화는 나중에 (에러 처리 후)
            // abortController를 null로 설정하면 signal에 접근할 수 없으므로 일단 유지
            
            // 백그라운드 탭에서도 즉시 반영되도록 최우선으로 UI 업데이트
            // 1. 플래그 즉시 설정
            this.isGenerating = false;
            
            // 2. 버튼 아이콘 직접 변경 (DOM 조작, 동기적 즉시 실행)
            const icon = document.getElementById('send-btn-icon');
            if (icon) {
                icon.className = 'fa-solid fa-play';
                if (this.elements.sendBtn) {
                    this.elements.sendBtn.classList.remove('generating');
                }
            }
            
            // 3. AI 로더 직접 숨김 (DOM 조작, 동기적 즉시 실행)
            if (!this.aiLoader) {
                this.aiLoader = document.getElementById('ai-loader');
            }
            if (this.aiLoader) {
                this.aiLoader.classList.add('hidden');
            }
            
            // 4. 대필 버튼 상태 업데이트
            this.updateAutofillButtonState();
            
            // 5. 정확한 버튼 상태 업데이트 (나중에 실행)
            Promise.resolve().then(() => {
                this.updateSendButtonState();
            }).catch((error) => {
                console.debug('[abortGeneration] updateSendButtonState 중 오류 (무시):', error);
            });
        }
    }

    /**
     * 전송 버튼 아이콘 상태 변경
     * @param {string} state - 'play', 'stop', 또는 'forward'
     */
    updateSendButtonIcon(state) {
        const icon = document.getElementById('send-btn-icon');
        if (!icon) return;

        if (state === 'stop') {
            icon.className = 'fa-solid fa-stop';
            this.elements.sendBtn.classList.add('generating');
        } else if (state === 'forward') {
            icon.className = 'fa-solid fa-forward';
            this.elements.sendBtn.classList.remove('generating');
        } else {
            icon.className = 'fa-solid fa-play';
            this.elements.sendBtn.classList.remove('generating');
        }
    }

    /**
     * 메시지 전송
     */
    async sendMessage() {
        // 생성 중이면 중단
        if (this.isGenerating) {
            await this.abortGeneration();
            return;
        }

        const text = this.elements.messageInput.value.trim();
        const chatHistory = this.getChatHistory();
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
        
        // 입력창이 비어있을 때의 처리
        let generateType = 'normal';
        let shouldAddUserMessage = false;
        let userMessageToSend = text || '';
        let processedUserMessage = ''; // 정규식 적용된 사용자 메시지
        
        if (!text) {
            // 입력창이 비어있을 때
            // 기존 로직 우선: 채팅이 비어있지 않으면 기존 continue/재전송 로직 사용
            if (chatHistory.length > 0) {
                // 기존 로직: continue 또는 재전송
                if (lastMessage) {
                if (lastMessage.role === 'user') {
                        // 마지막 메시지가 유저 메시지: 직전 메시지 그대로 사용 (재전송)
                    generateType = 'normal';
                    shouldAddUserMessage = false;
                    userMessageToSend = ''; // 빈 문자열로 전달하면 채팅 히스토리의 마지막 유저 메시지가 사용됨
                } else if (lastMessage.role === 'assistant') {
                    // 마지막 메시지가 캐릭터 메시지: continue로 이어서 생성
                    generateType = 'continue';
                        shouldAddUserMessage = false;
                        userMessageToSend = '';
                    }
                }
            } else {
                // 채팅이 완전히 비어있을 때만 send_if_empty 사용 (기존 로직과 충돌 없음)
                // SettingsStorage - 전역 스코프에서 사용
                const settings = await SettingsStorage.load();
                const sendIfEmpty = settings.send_if_empty || '';
                
                if (sendIfEmpty && sendIfEmpty.trim()) {
                    // send_if_empty가 있으면 그 값을 사용자 메시지로 사용
                    // 정규식 적용
                    processedUserMessage = await getRegexedString(sendIfEmpty.trim(), REGEX_PLACEMENT.USER_INPUT);
                    userMessageToSend = processedUserMessage;
                    shouldAddUserMessage = true;
                    generateType = 'normal';
                } else {
                    // send_if_empty도 없으면 기존 로직 (프롬프트만 전송)
                    generateType = 'normal';
                    shouldAddUserMessage = false;
                    userMessageToSend = '';
                }
            }
        } else {
            // 입력창에 텍스트가 있을 때: 정규식 적용 후 유저 메시지 추가
            // 정규식 적용 (사용자 입력) - 실리태번과 동일: sendMessageAsUser 함수 참고
            // 옵션을 전달하지 않으므로 isMarkdown과 isPrompt는 undefined가 됨
            // 따라서 markdownOnly와 promptOnly가 모두 false인 스크립트가 적용됨 (직접 편집)
            // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
            processedUserMessage = await getRegexedString(text, REGEX_PLACEMENT.USER_INPUT);
            userMessageToSend = processedUserMessage;
            shouldAddUserMessage = true;
            generateType = 'normal';
        }

        // 유저 메시지 추가 (필요한 경우에만)
        if (shouldAddUserMessage) {

            // 현재 페르소나 아바타 가져오기 (실리태번과 동일)
            let userAvatar = null;
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            
            if (currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentPersonaId);
                if (persona && persona.avatar) {
                    userAvatar = persona.avatar;
                }
            }
            
            // 사용자 메시지 추가 (페르소나 아바타 포함)
            // 중요: 정규식으로 처리된 텍스트를 전달 (직접 편집 정규식 적용 후)
            // addMessage 내부에서는 표시용으로 추가 정규식 적용 (markdownOnly 정규식 등)
            await this.addMessage(processedUserMessage, 'user', null, null, [], 0, userAvatar);

            // DOM 업데이트 완료 대기 (백그라운드 탭에서도 작동)
            // waitForDOMUpdate - 전역 스코프에서 사용
            if (typeof waitForDOMUpdate === 'function') {
                await waitForDOMUpdate();
            } else {
                // 폴백: requestAnimationFrame 사용
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
        }

        // 입력창 초기화
        this.elements.messageInput.value = '';
        // 높이를 명시적으로 초기 높이로 재설정
        this.elements.messageInput.style.height = '44px';
        // 강제로 리플로우를 트리거하여 높이 재계산
        this.elements.messageInput.offsetHeight;

        // AbortController 생성 및 버튼 상태 변경
        this.abortController = new AbortController();
        this.isGenerating = true;
        this.updateSendButtonIcon('stop');
        this.updateAutofillButtonState();
        // 생성 중이므로 버튼 상태 업데이트 (정지 버튼으로 활성화)
        this.updateSendButtonState();
        await this.showAILoader(true); // AI 로더 표시

        // AI 응답 처리
        let generationSuccess = false;
        try {
            await this.generateAIResponse(userMessageToSend, generateType);
            generationSuccess = true; // 정상 완료
        } catch (error) {
            // AbortError 또는 사용자 정지 버튼 클릭은 정상적인 중단이므로 에러 메시지 표시하지 않음
            // AbortError는 error.name이 'AbortError'이거나, signal.aborted가 true이거나,
            // 또는 에러 메시지에 '취소', 'abort', 'stop' 등이 포함될 수 있음
            const isAbortError = error.name === 'AbortError' || 
                                 error.message === '요청이 취소되었습니다.' ||
                                 error.message === 'User clicked stop button' ||
                                 error.message?.includes('abort') ||
                                 error.message?.includes('취소') ||
                                 error.message?.includes('cancel') ||
                                 (error instanceof DOMException && error.name === 'AbortError');
            
            if (isAbortError) {
                // AbortError 발생 시 즉시 return하여 추가 작업 방지
                // sendAIMessage 내부에서 이미 signal 체크를 하고 있지만,
                // catch 블록에서 확실히 중단되도록 보장
                return;
            }
            
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3004', 'AI 응답 생성 중 오류가 발생했습니다', error);
            }
            // 에러 메시지를 토스트 알림으로 표시
            if (typeof showToast === 'function') {
                showToast(`오류가 발생했습니다: ${error.message}`, 'error');
            } else {
                alert(`오류가 발생했습니다: ${error.message}`);
            }
        } finally {
        // 생성 완료 또는 중단 시 상태 초기화
        // abortGeneration에서 이미 로더를 숨겼지만, finally에서도 확실히 처리
        
        // 백그라운드 탭에서도 즉시 반영되도록 최우선으로 UI 업데이트
        // 1. 플래그 즉시 설정 (가장 중요)
        this.abortController = null;
        this.isGenerating = false;
        
        // 2. 버튼 아이콘 직접 변경 (DOM 조작, 동기적 즉시 실행)
        const icon = document.getElementById('send-btn-icon');
        if (icon) {
            icon.className = 'fa-solid fa-play';
            if (this.elements.sendBtn) {
                this.elements.sendBtn.classList.remove('generating');
            }
        }
        
        // 3. AI 로더 직접 숨김 (DOM 조작, 동기적 즉시 실행)
        if (!this.aiLoader) {
            this.aiLoader = document.getElementById('ai-loader');
        }
        if (this.aiLoader) {
            this.aiLoader.classList.add('hidden');
        }
        
        // 4. 대필 버튼 상태 업데이트 (동기 함수)
        this.updateAutofillButtonState();
        
        // 5. 효과음 재생 (비동기, await 없이)
        if (generationSuccess && typeof playMessageSound === 'function') {
            playMessageSound().catch((error) => {
                console.debug('[sendMessage] 효과음 재생 중 오류 (무시):', error);
            });
        }
        
        // 6. 정확한 버튼 상태 업데이트 (나중에 실행, getChatHistory 호출 포함)
        // 백그라운드에서도 작동하도록 비동기로 실행
        Promise.resolve().then(() => {
            this.updateSendButtonState();
        }).catch((error) => {
            console.debug('[sendMessage] updateSendButtonState 중 오류 (무시):', error);
        });
        }
    }

    /**
     * AI 응답 생성
     * ⚠️ 이 함수는 aiMessageSender.js로 이동되었습니다.
     * 관련 요청사항이 있기 전까지 이 함수를 수정하지 마세요.
     * @param {string} userMessage - 사용자 메시지 (정규식 적용 전 원본)
     * @param {string} generateType - 생성 타입 ('normal' 또는 'continue')
     */
    async generateAIResponse(userMessage, generateType = 'normal', skipGreetingCheck = false) {
        // ⚠️ 핵심 로직은 aiMessageSender.js로 이동되었습니다.
        // 관련 요청사항이 있기 전까지 이 함수를 수정하지 마세요.
        // sendAIMessage - 전역 스코프에서 사용
        // tokenCountFn은 sendAIMessage 내부에서 promptManager를 통해 가져옴
        await sendAIMessage(userMessage, this, generateType, null, skipGreetingCheck);
    }

    /**
     * 현재 채팅 히스토리 가져오기
     * 중요: 이 함수는 DOM에서만 읽으므로:
     * - 대필 지시문 및 대필 결과는 포함되지 않음 (DOM에 추가되지 않으므로)
     * - 삭제된 메시지는 포함되지 않음 (DOM에서 제거되므로)
     * - 수정된 메시지는 최종 수정된 내용만 포함됨 (DOM이 업데이트되므로)
     * - 스와이프 중 선택되지 않은 항목은 포함되지 않음 (DOM에 표시되지 않으므로)
     * @returns {Array} 채팅 히스토리 배열 [{ role, content }]
     */
    getChatHistory() {
        const history = [];
        // 중요: querySelectorAll은 display:none이나 hidden 클래스가 있어도 모든 요소를 반환함
        // 하지만 삭제된 메시지는 DOM에서 완전히 제거되므로 querySelectorAll로는 찾을 수 없음
        // 따라서 DOM에서 찾은 메시지만 채팅 히스토리에 포함됨
        const messageWrappers = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        
        // 디버깅: getChatHistory 호출 시점의 메시지 수 확인 (console.debug로 변경)
        console.debug('[ChatManager.getChatHistory] DOM에서 메시지 읽기:', {
            wrapperCount: messageWrappers.length,
            chatArrayLength: this.chat?.length || 0,
            // 실제 wrapper의 UUID 확인
            wrapperUuids: Array.from(messageWrappers).map(w => w.dataset.messageUuid?.substring(0, 8) || 'no-uuid')
        });
        
        messageWrappers.forEach((wrapper) => {
            // 삭제된 메시지는 parentNode가 없거나 chatMessages의 자식이 아닐 수 있음
            // 하지만 remove() 호출 후에는 querySelectorAll로 찾을 수 없으므로 이 체크는 사실상 불필요
            // 안전장치로 추가
            if (!wrapper.parentNode || !this.elements.chatMessages.contains(wrapper)) {
                return; // DOM에서 제거된 메시지는 건너뜀
            }
            
            const messageDiv = wrapper.querySelector('.message');
            if (!messageDiv) return;

            const isUser = messageDiv.classList.contains('user');
            const messageText = wrapper.querySelector('.message-text');
            if (!messageText) return;

            // 원본 텍스트 가져오기 (정규식 적용 전)
            // 중요: dataset.originalText가 빈 문자열일 수도 있으므로 명시적으로 확인
            let originalText = wrapper.dataset.originalText;
            if (originalText === undefined || originalText === null) {
                // dataset.originalText가 없으면 messageText에서 가져오기
                originalText = messageText.textContent.trim();
            }
            
            // 페르소나 아바타 가져오기 (유저 메시지에만)
            const forceAvatar = wrapper.dataset.forceAvatar || null;
            
            // 실리태번과 동일: send_date 가져오기 (순서 보장용)
            const sendDate = parseInt(wrapper.dataset.sendDate) || Date.now();
            
            // 중요: originalText가 빈 문자열이어도 메시지가 DOM에 존재하면 포함해야 함
            // 그리팅 메시지 등에서 originalText가 설정되지 않았을 수 있음
            // messageText.textContent가 있으면 메시지가 존재하는 것으로 간주
            if (originalText !== undefined && originalText !== null && 
                (originalText !== '' || messageText.textContent.trim() !== '')) {
                const messageObj = {
                    role: isUser ? 'user' : 'assistant',
                    content: originalText,
                    _sendDate: sendDate, // 정렬용 (내부 사용)
                };
                
                // 실리태번과 동일: 추론(thinking)은 채팅 히스토리에 포함하지 않음
                // 추론은 message.extra.reasoning에 저장되지만, content에는 포함되지 않음
                // 따라서 getChatHistory에서도 추론을 제외하고 content만 반환
                
                // 실리태번과 동일: force_avatar 추가
                const forceAvatar = wrapper.dataset.forceAvatar || null;
                if (isUser && forceAvatar) {
                    messageObj.force_avatar = forceAvatar;
                }
                
                // 실리태번과 동일: name 필드 추가 (names_behavior 지원용)
                // assistant 메시지의 경우 캐릭터 이름 저장
                if (!isUser) {
                    const characterNameFromWrapper = wrapper.dataset.characterName || null;
                    if (characterNameFromWrapper) {
                        messageObj.name = characterNameFromWrapper;
                    }
                }
                // user 메시지의 경우 페르소나 이름은 name 필드에 저장하지 않음 (실리태번과 동일)
                
                history.push(messageObj);
            }
        });
        
        // 실리태번과 동일: send_date 기준으로 정렬 (순서 보장)
        history.sort((a, b) => (a._sendDate || 0) - (b._sendDate || 0));
        
        // 정렬 후 _sendDate 제거 (내부용이므로 반환값에서 제외)
        history.forEach(msg => delete msg._sendDate);

        // 디버깅: 반환되는 히스토리 확인 (console.debug로 변경)
        if (history.length > 0) {
            const historyPreview = history.map(msg => ({
                role: msg.role,
                contentPreview: msg.content?.substring(0, 50) || 'no-content',
                uuid: msg.uuid?.substring(0, 8) || 'no-uuid'
            }));
            console.debug('[ChatManager.getChatHistory] ✅ 반환되는 히스토리:', {
                historyCount: history.length,
                historyPreview: historyPreview
            });
        } else {
            console.debug('[ChatManager.getChatHistory] ✅ 히스토리 비어있음 (메시지 0개)');
        }

        return history;
    }

    /**
     * 더보기 버튼 추가
     * 
     * ⚠️ 중요: loadChat에서 startIndex > 0일 때 호출됩니다.
     * 
     * [연동 기능]
     * - loadChat: startIndex 계산 후 startIndex > 0이면 이 함수 호출
     * - loadMoreMessagesFromStart: 버튼 클릭 시 호출되어 이전 메시지 로드
     * 
     * @param {number} startIndex - 숨겨진 메시지의 시작 인덱스 (loadChat에서 계산된 값)
     * @param {string} chatId - 채팅 ID (없으면 현재 채팅 ID 사용)
     */
    async addLoadMoreButton(startIndex, chatId = null) {
        // 기존 "더보기" 버튼이 있으면 제거
        const existingBtn = this.elements.chatMessages.querySelector('.load-more-messages-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // "더보기" 버튼 생성
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'load-more-messages-btn';
        loadMoreBtn.innerHTML = `<i class="fa-solid fa-chevron-up"></i> 이전 메시지 ${startIndex}개 더보기`;
        loadMoreBtn.setAttribute('aria-label', `이전 메시지 ${startIndex}개 더보기`);
        
        loadMoreBtn.addEventListener('click', async () => {
            await this.loadMoreMessagesFromStart(startIndex, chatId);
            loadMoreBtn.remove();
        });
        
        // 채팅 메시지 컨테이너의 최상단에 추가
        const firstMessage = this.elements.chatMessages.querySelector('.message-wrapper');
        if (firstMessage) {
            this.elements.chatMessages.insertBefore(loadMoreBtn, firstMessage);
        } else {
            this.elements.chatMessages.insertBefore(loadMoreBtn, this.elements.chatMessages.firstChild);
        }
    }

    /**
     * 더 많은 메시지 로드 (기존 방식 - 숨겨진 메시지 표시)
     * @param {number} count - 표시할 메시지 수
     */
    async loadMoreMessages(count) {
        const hiddenMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper.message-hidden');
        
        if (hiddenMessages.length === 0) {
            return;
        }
        
        const chatContainer = this.elements.chatMessages;
        
        // 현재 스크롤 위치 저장
        const currentScrollTop = chatContainer.scrollTop;
        
        // "더보기" 버튼의 높이 저장 (버튼이 제거될 예정)
        const loadMoreBtn = chatContainer.querySelector('.load-more-messages-btn');
        const loadMoreBtnHeight = loadMoreBtn ? (loadMoreBtn.offsetHeight || 0) : 0;
        
        // 숨겨진 메시지들을 순서대로 표시
        const maxToShow = Math.min(count, hiddenMessages.length);
        let shownCount = 0;
        
        for (let i = 0; i < maxToShow; i++) {
            const wrapper = hiddenMessages[i];
            wrapper.style.display = '';
            wrapper.classList.remove('message-hidden');
            shownCount++;
        }
        
        // DOM 업데이트 완료 대기 (백그라운드 탭에서도 작동)
        // waitForDOMUpdate - 전역 스코프에서 사용
        if (typeof waitForDOMUpdate === 'function') {
            await waitForDOMUpdate();
        } else {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        
        // 새로 표시된 메시지들의 총 높이 계산 (표시 후)
        let totalAddedHeight = loadMoreBtnHeight;
        for (let i = 0; i < maxToShow; i++) {
            const wrapper = hiddenMessages[i];
            totalAddedHeight += wrapper.offsetHeight || wrapper.scrollHeight || 0;
        }
        
        // 스크롤 위치 조정: 새로 추가된 메시지 높이만큼 아래로 스크롤
        // 이렇게 하면 사용자가 보고 있던 위치는 유지되고 위에만 메시지가 추가됨
        chatContainer.scrollTop = currentScrollTop + totalAddedHeight;
        
        // 남은 숨겨진 메시지가 있으면 "더보기" 버튼 다시 추가
        const remainingHidden = this.elements.chatMessages.querySelectorAll('.message-wrapper.message-hidden').length;
        if (remainingHidden > 0) {
            await this.addLoadMoreButton(remainingHidden);
        }
        
    }

    /**
     * 시작 인덱스부터 이전 메시지 로드 (성능 최적화용)
     * @param {number} startIndex - 로드 시작할 메시지 인덱스
     * @param {string} chatId - 채팅 ID (옵션)
     */
    /**
     * 더보기 기능: 이전 메시지 로드
     * 
     * ⚠️ 중요: 이 함수는 loadChat과 강하게 연동되어 있습니다.
     * 
     * [연동 기능]
     * 1. loadChat의 startIndex: 이 함수의 startIndex는 loadChat에서 계산된 값
     * 2. messagesToLoad 설정: 한 번에 로드할 메시지 수 (loadChat과 동일한 설정값 사용)
     * 3. htmlRenderLimit: 역순 인덱스 기준으로 최근 N개만 HTML 렌더링 (loadChat과 동일 로직)
     *    * ⚠️ 중요: HTML 렌더링 제한이 정규식보다 우선 적용됨
     *    * 정규식은 먼저 적용되지만, 렌더링 제한에 의해 최근 N개가 아닌 메시지는 플레이스홀더로 표시됨
     * 4. 정규식: 모든 메시지 렌더링 시 getRegexedString 호출 (loadChat과 동일, isMarkdown: true)
     *    * 정규식 적용 후 HTML 렌더링 제한 적용
     * 
     * [수정 시 주의사항]
     * - endIndex 계산 변경 시 → loadChat의 startIndex 계산과 일치해야 함
     *   * endIndex = Math.max(1, startIndex - messagesToLoad)
     *   * loadChat: if (chat.length > count) { startIndex = chat.length - count; }
     * - htmlRenderLimit 적용 변경 시 → loadChat의 applyHtmlRenderLimit과 동일한 로직 사용
     *   * ⚠️ 중요: 정규식 적용 후 HTML 렌더링 제한 적용 순서 유지
     * - 스크롤 위치 고정 로직 변경 시 → 메시지 추가 위치 확인
     * - 정규식과 HTML 렌더링 제한: 모든 메시지 렌더링 시 정규식 적용 후 HTML 렌더링 제한 적용
     * 
     * @param {number} startIndex - 로드할 메시지의 시작 인덱스 (loadChat에서 계산된 값)
     * @param {string} chatId - 채팅 ID (없으면 현재 채팅 ID 사용)
     */
    async loadMoreMessagesFromStart(startIndex, chatId = null) {
        // 더보기 로딩 중 플래그 설정 (저장 방지)
        this._isLoadingMoreMessages = true;
        
        try {
        // 저장된 채팅 데이터가 있으면 사용, 없으면 다시 로드
        let chatData = this._storedChatData;
        let characterName = this._storedCharacterName;
        let characterAvatar = this._storedCharacterAvatar;
        
        if (!chatData && chatId) {
            chatData = await ChatStorage.load(chatId);
            if (!chatData) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_CHAT_3005', 'Chat을 찾을 수 없음 (loadMoreMessagesFromStart)');
                }
                return;
            }
            const character = await CharacterStorage.load(chatData.characterId);
            characterName = character?.data?.name || character?.name || 'Character';
            characterAvatar = character?.avatar_image || 
                           character?.avatarImage || 
                           character?.data?.avatar_image ||
                           (character?.avatar && character?.avatar !== 'none' ? character?.avatar : null) ||
                           null;
        }
        
        if (!chatData) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3006', '채팅 데이터 없음 (loadMoreMessagesFromStart)');
            }
            return;
        }
        
        // 실리태번과 동일: 메시지 순서는 저장 시 이미 확정됨
        // 불러오기 시 파일 순서를 그대로 유지하므로, 정렬 불필요
        let messages = chatData.messages || [];
        // 정렬 제거: 저장 시 이미 올바른 순서로 저장되어 있음
        
        // 실리태번 호환: 첫 번째 메시지는 인덱스 0에 있음
        // startIndex가 0 이하면 인덱스 0부터 모든 메시지가 이미 로드된 것
        // startIndex가 메시지 길이보다 크거나 같으면 이미 모든 메시지가 로드된 것
        // endIndex >= startIndex이면 로드할 메시지가 없음
        if (startIndex <= 0 || startIndex >= messages.length) {
            // 모든 메시지가 로드되었으므로 더보기 버튼 제거
            const loadMoreBtn = this.elements.chatMessages.querySelector('.load-more-messages-btn');
            if (loadMoreBtn) {
                loadMoreBtn.remove();
            }
            return;
        }
        
        // 실리태번 호환: messages 배열이 비어있거나 유효하지 않으면 종료
        if (!messages || messages.length === 0) {
            return;
        }
        
        const chatContainer = this.elements.chatMessages;
        const currentScrollTop = chatContainer.scrollTop;
        const loadMoreBtn = chatContainer.querySelector('.load-more-messages-btn');
        const loadMoreBtnHeight = loadMoreBtn ? (loadMoreBtn.offsetHeight || 0) : 0;
        
        // 스크롤 위치 고정을 위한 참조 요소: 더보기 버튼이 있으면 더보기 버튼, 없으면 첫 번째 메시지
        // 더보기 버튼이 제거될 수 있으므로 첫 번째 메시지도 함께 저장
        const firstMessageBeforeLoad = chatContainer.querySelector('.message-wrapper');
        
        // 설정에서 로딩할 메시지 수 가져오기 (한 번에 로드할 메시지 수)
        const settings = await SettingsStorage.load();
        const messagesToLoad = settings.messagesToLoad ?? 50; // 기본값 50개씩
        const htmlRenderLimit = settings.htmlRenderLimit ?? 0;
        
        // 실리태번과 동일: startIndex부터 이전 messagesToLoad개 메시지 로드
        // messages.slice(endIndex, startIndex)는 endIndex부터 startIndex-1까지 포함
        // 인덱스 0도 포함해야 하므로, endIndex는 최소 0 (인덱스 0부터 startIndex-1까지 로드)
        const endIndex = Math.max(0, startIndex - messagesToLoad);
        const messagesToRender = messages.slice(endIndex, startIndex);
        
        // 렌더링된 인덱스 추적 (중복 방지)
        const renderedIndexes = new Set();
        
        console.debug('[ChatManager.loadMoreMessagesFromStart] 더보기 로딩:', {
            startIndex,
            endIndex,
            messagesToLoad,
            messagesToRenderCount: messagesToRender.length,
            messagesRange: `${endIndex} ~ ${startIndex - 1}`,
            existingDOMCount: chatContainer.querySelectorAll('.message-wrapper').length
        });
        
        // 첫 번째 메시지 찾기 (위에 추가할 위치)
        const firstMessage = chatContainer.querySelector('.message-wrapper');
        
        // 스크롤 위치 고정을 위한 참조 요소: 더보기 버튼이 있으면 더보기 버튼, 없으면 첫 번째 메시지
        // 더보기 버튼이 제거될 수 있으므로 첫 번째 메시지를 참조 요소로 사용
        const referenceElement = firstMessageBeforeLoad || firstMessage;
        let referenceElementTop = 0;
        if (referenceElement) {
            const rect = referenceElement.getBoundingClientRect();
            referenceElementTop = rect.top + chatContainer.scrollTop;
        }
        
        // 기존 DOM 메시지의 UUID 집합 (중복 방지용)
        const existingUuids = new Set();
        chatContainer.querySelectorAll('.message-wrapper').forEach(wrapper => {
            const uuid = wrapper.dataset.messageUuid;
            if (uuid) {
                existingUuids.add(uuid);
            }
        });
        
        console.debug('[ChatManager.loadMoreMessagesFromStart] 기존 DOM UUID 수:', existingUuids.size);
        
        // 메시지를 순서대로 렌더링 (오래된 것부터)
        // 실리태번과 동일: 원본 배열 인덱스를 저장 (forceId)
        // messagesToRender는 endIndex부터 startIndex-1까지 순서대로 (오래된 메시지부터 새로운 메시지)
        // DOM에 추가할 때도 순서대로 추가하면 됨 (insertBefore이므로 첫 번째 요소가 위에)
        const messageFragments = [];
        let skippedCount = 0;
        
        // messagesToRender를 순서대로 순회 (오래된 메시지부터 새로운 메시지)
        for (const message of messagesToRender) {
            // 원본 배열에서 메시지 인덱스 찾기 (UUID로 매칭)
            let messageIndex = -1;
            if (message.uuid) {
                const index = messages.findIndex(m => m.uuid === message.uuid);
                if (index >= 0) {
                    messageIndex = index;
                }
            }
            // UUID가 없거나 찾지 못한 경우, send_date로 찾기
            if (messageIndex < 0 && message.send_date) {
                const index = messages.findIndex(m => m.send_date === message.send_date && m.mes === message.mes);
                if (index >= 0) {
                    messageIndex = index;
                }
            }
            // 여전히 찾지 못한 경우, endIndex부터 startIndex-1 범위에서 인덱스 계산
            if (messageIndex < 0) {
                const indexInSlice = messagesToRender.indexOf(message);
                if (indexInSlice >= 0) {
                    messageIndex = endIndex + indexInSlice;
                }
            }
            // 이미 DOM에 있는 메시지는 건너뛰기 (중복 방지)
            if (message.uuid && existingUuids.has(message.uuid)) {
                console.debug('[ChatManager.loadMoreMessagesFromStart] 중복 메시지 건너뛰기:', {
                    uuid: message.uuid.substring(0, 8),
                    send_date: message.send_date,
                    mes: message.mes?.substring(0, 50)
                });
                skippedCount++;
                continue;
            }
                // 실리태번과 동일: force_avatar 가져오기 (유저 메시지에만)
                // force_avatar가 페르소나 이름일 수 있으므로 실제 아바타 이미지 URL로 변환
                let userAvatar = message.force_avatar || null;
                
                // 유저 메시지인 경우 페르소나 아바타 처리
                if (message.is_user) {
                    // force_avatar가 있고 이미지 URL이 아닌 경우 (페르소나 이름일 가능성)
                    if (userAvatar && !userAvatar.startsWith('data:') && !userAvatar.startsWith('http://') && !userAvatar.startsWith('https://')) {
                        // 페르소나 이름으로 페르소나 찾기
                        try {
                            const allPersonas = await UserPersonaStorage.loadAll();
                            // 페르소나 이름으로 찾기 (정확한 이름 매칭)
                            let foundPersona = null;
                            for (const [personaId, persona] of Object.entries(allPersonas)) {
                                if (persona?.name === userAvatar || personaId === userAvatar) {
                                    foundPersona = persona;
                                    break;
                                }
                            }
                            // 이름이 찾아지면 아바타 이미지로 변환
                            if (foundPersona && foundPersona.avatar) {
                                userAvatar = foundPersona.avatar;
                            }
                        } catch (e) {
                            // 페르소나 찾기 실패 시 원본 그대로 사용
                            console.debug('[ChatManager] 페르소나 찾기 실패 (force_avatar), 원본 사용:', userAvatar);
                        }
                    }
                    
                    // force_avatar가 없거나 이미지 URL이 아닌 경우, message.name으로 페르소나 찾기 시도
                    if (!userAvatar || (!userAvatar.startsWith('data:') && !userAvatar.startsWith('http://') && !userAvatar.startsWith('https://'))) {
                        const userName = message.name || '';
                        if (userName) {
                            try {
                                const allPersonas = await UserPersonaStorage.loadAll();
                                // 메시지의 name 필드와 일치하는 페르소나 찾기
                                let foundPersona = null;
                                for (const [personaId, persona] of Object.entries(allPersonas)) {
                                    if (persona?.name === userName) {
                                        foundPersona = persona;
                                        break;
                                    }
                                }
                                // 페르소나가 찾아지고 아바타가 있으면 사용
                                if (foundPersona && foundPersona.avatar) {
                                    userAvatar = foundPersona.avatar;
                                    console.debug('[ChatManager.loadChat] message.name으로 페르소나 아바타 찾음:', {
                                        userName,
                                        personaName: foundPersona.name,
                                        hasAvatar: !!foundPersona.avatar
                                    });
                                }
                            } catch (e) {
                                console.debug('[ChatManager] 페르소나 찾기 실패 (message.name), 원본 사용:', userName);
                            }
                        }
                    }
                }
            
            // 실리태번과 동일: 메시지 고유 ID 및 send_date 가져오기
            const messageUuid = message.uuid || null;
            const sendDate = message.send_date || null;
            
            // 실리태번과 동일: 메시지의 name 필드 확인 (다른 캐릭터가 보낸 메시지 처리)
            // message.name이 있고 characterName과 다르면, message.name을 사용하고 아바타는 기본 아이콘으로
            let messageCharacterName = characterName;
            let messageCharacterAvatar = characterAvatar;
            
            if (!message.is_user && message.name) {
                // 메시지의 name 필드가 characterName과 다른 경우 (다른 캐릭터가 보낸 메시지)
                if (message.name !== characterName) {
                    messageCharacterName = message.name;
                    messageCharacterAvatar = null; // 다른 캐릭터는 기본 아이콘 사용
                }
            }
            
            const wrapper = await this.addMessage(
                message.mes,
                message.is_user ? 'user' : 'assistant',
                message.is_user ? null : messageCharacterName,
                message.is_user ? null : messageCharacterAvatar,
                message.extra?.swipes || [],
                0,
                message.is_user ? userAvatar : null,
                sendDate || null, // send_date 전달
                message.extra?.reasoning || null // 추론 내용 복원
            );
            
            // addMessage는 DOM에 자동으로 추가하므로, 더보기에서는 제거하여 나중에 한 번에 추가
            if (wrapper.parentNode) {
                wrapper.parentNode.removeChild(wrapper);
            }
            
            // 더보기로 로드하는 메시지는 애니메이션 제거 (실제 새 메시지가 아닌 이미 존재하는 메시지)
            const messageDiv = wrapper.querySelector('.message');
            if (messageDiv) {
                messageDiv.style.animation = 'none';
            }
            
            // 실리태번과 동일: 저장된 UUID와 send_date를 DOM에 복원 (구 메시지 호환)
            if (messageUuid) {
                wrapper.dataset.messageUuid = messageUuid;
            }
            if (sendDate) {
                wrapper.dataset.sendDate = sendDate.toString();
            }
            // 추론 내용도 dataset에 저장 (saveChat에서 읽기 위해)
            if (message.extra?.reasoning) {
                wrapper.dataset.reasoning = message.extra.reasoning;
            }
            // 실리태번과 동일: 원본 배열 인덱스 저장 (forceId)
            if (messageIndex >= 0) {
                wrapper.dataset.messageIndex = messageIndex.toString();
                renderedIndexes.add(messageIndex);
            }
            
            messageFragments.push(wrapper);
            
            // 추가한 메시지의 UUID를 집합에 추가 (다음 반복에서 중복 방지)
            if (messageUuid) {
                existingUuids.add(messageUuid);
            }
        }
        
        console.debug('[ChatManager.loadMoreMessagesFromStart] 추가할 메시지:', {
            totalToAdd: messageFragments.length,
            skipped: skippedCount
        });
        
        // DOM에 한 번에 추가 (DocumentFragment 사용)
        // messageFragments는 이미 오래된 메시지부터 새로운 메시지 순서로 추가되었으므로
        // reverse() 없이 그대로 사용 (오래된 메시지가 위에, 새로운 메시지가 아래에)
        const fragment = document.createDocumentFragment();
        messageFragments.forEach(wrapper => {
            fragment.appendChild(wrapper);
        });
        
        // 한 번에 DOM에 추가 (스크롤이 움직이지 않도록)
        if (firstMessage) {
            chatContainer.insertBefore(fragment, firstMessage);
        } else {
            chatContainer.insertBefore(fragment, chatContainer.firstChild);
        }
        
        // DOM 업데이트 완료 대기 (백그라운드 탭에서도 작동)
        // waitForDOMUpdate - 전역 스코프에서 사용
        if (typeof waitForDOMUpdate === 'function') {
            await waitForDOMUpdate();
        } else {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        
        // HTML 렌더링 제한 적용: 새로 추가된 메시지 포함하여 모든 메시지에 제한 적용
        // DOM 업데이트 완료 대기 (백그라운드 탭에서도 작동)
        if (typeof waitForDOMUpdate === 'function') {
            await waitForDOMUpdate();
        } else {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
        
        if (htmlRenderLimit > 0) {
            // 모든 메시지 확인 (새로 추가된 메시지 포함)
            const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
            
            // 역순 인덱스 계산: 최근 메시지가 인덱스 0, 1, 2...
            // 배열을 역순으로 순회 (최근 메시지부터)
            const reversedWrappers = [...allMessageWrappers].reverse();
            
            reversedWrappers.forEach((wrapper, reverseIndex) => {
                // reverseIndex가 0이면 최근 메시지, 1이면 그 다음 최근 메시지...
                const messageText = wrapper.querySelector('.message-text');
                
                if (messageText) {
                    if (reverseIndex >= htmlRenderLimit) {
                        // 제한 범위를 벗어난 메시지는 플레이스홀더로 교체
                        this.renderHtmlIframesInElement(messageText, true);
                    } else {
                        // 제한 범위 내의 메시지는 렌더링 (플레이스홀더가 있으면 복원)
                        this.renderHtmlIframesInElement(messageText, false);
                    }
                }
            });
        } else {
            // htmlRenderLimit이 0이면 모든 메시지 렌더링 (플레이스홀더 복원)
            const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
            
            allMessageWrappers.forEach(wrapper => {
                const messageText = wrapper.querySelector('.message-text');
                if (messageText) {
                    this.renderHtmlIframesInElement(messageText, false);
                }
            });
        }
        
        // 스크롤 위치 고정: 현재 스크롤 위치를 유지
        // 메시지 추가 후 참조 요소의 위치 변화를 계산하여 스크롤 보정
        if (referenceElement && messageFragments.length > 0) {
            // DOM 업데이트가 완전히 반영되도록 대기
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            
            // 참조 요소의 새로운 위치 계산 (메시지 추가 후)
            const newRect = referenceElement.getBoundingClientRect();
            const newReferenceElementTop = newRect.top + chatContainer.scrollTop;
            
            // 참조 요소가 이동한 거리 계산 (메시지가 위에 추가되어 참조 요소가 아래로 이동)
            const referenceElementOffset = newReferenceElementTop - referenceElementTop;
            
            // 스크롤 위치 조정: 참조 요소가 원래 화면상 위치에 있도록 보정
            // 현재 스크롤 위치 + 참조 요소의 이동 거리 = 새로운 스크롤 위치
            chatContainer.scrollTop = currentScrollTop + referenceElementOffset;
            
            // 레이아웃이 완전히 안정화될 때까지 추가 대기 후 최종 보정
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            
            // 최종 보정: 참조 요소가 정확히 원래 위치에 있는지 확인
            const finalRect = referenceElement.getBoundingClientRect();
            const finalReferenceElementTop = finalRect.top + chatContainer.scrollTop;
            const finalOffset = finalReferenceElementTop - referenceElementTop;
            
            // 1픽셀 이상 차이가 있으면 최종 보정
            if (Math.abs(finalOffset) > 1) {
                chatContainer.scrollTop = currentScrollTop + finalOffset;
            }
        }
        
        // 더 로드할 메시지가 있으면 "더보기" 버튼 다시 추가
        // 실리태번 호환: 첫 번째 메시지(인덱스 0)까지 포함해야 함
        // endIndex가 0보다 크면 아직 로드할 메시지가 더 있는 것이므로 버튼 추가
        // endIndex === 0이면 인덱스 0부터 startIndex-1까지 모두 로드된 것이므로 버튼 제거
        if (endIndex > 0 && messages.length > renderedIndexes.size) {
            await this.addLoadMoreButton(endIndex, chatId);
        } else {
            // 더 로드할 메시지가 없으므로 더보기 버튼 제거 (모든 메시지 로드 완료)
            const remainingLoadMoreBtn = chatContainer.querySelector('.load-more-messages-btn');
            if (remainingLoadMoreBtn) {
                remainingLoadMoreBtn.remove();
            }
        }
        
        } finally {
            // 더보기 로딩 완료
            this._isLoadingMoreMessages = false;
        }
    }

    /**
     * API 응답에서 추론 내용 추출 (실리태번 방식 참고)
     * @param {object} data - API 응답 데이터
     * @param {string} apiProvider - API 제공자
     * @param {object} options - 추가 옵션 (chatCompletionSource 등)
     * @returns {string} 추출된 추론 내용
     */
    extractReasoningFromData(data, apiProvider, options = {}) {
        if (!data) return '';
        
        const chatCompletionSource = options.chatCompletionSource || options.chat_completion_source;
        const showThoughts = options.show_thoughts || options.showThoughts;
        
        switch (apiProvider) {
            case 'claude':
            case 'anthropic':
                // Claude의 thinking 필드
                if (data.content) {
                    const thinkingPart = Array.isArray(data.content) 
                        ? data.content.find(part => part.type === 'thinking')
                        : null;
                    const reasoning = thinkingPart?.thinking || '';
                    return reasoning;
                }
                // delta 형식 (스트리밍)
                if (data.delta?.thinking) {
                    return data.delta.thinking;
                }
                // thinking 타입 content_block_delta
                if (data.type === 'content_block_delta' && data.delta?.thinking) {
                    return data.delta.thinking;
                }
                break;
                
            case 'openai':
                if (!showThoughts) break;
                
                switch (chatCompletionSource) {
                    case 'deepseek':
                    case 'xai':
                        return data?.choices?.[0]?.message?.reasoning_content 
                            || data?.choices?.[0]?.delta?.reasoning_content 
                            || '';
                    case 'openrouter':
                        return data?.choices?.[0]?.message?.reasoning 
                            || data?.choices?.[0]?.delta?.reasoning 
                            || '';
                    case 'mistralai':
                        if (data?.choices?.[0]?.message?.content?.[0]?.thinking) {
                            return data.choices[0].message.content[0].thinking
                                .map(part => part.text)
                                .filter(x => x)
                                .join('\n\n');
                        }
                        if (data?.choices?.[0]?.delta?.content?.[0]?.thinking?.[0]?.text) {
                            return data.choices[0].delta.content[0].thinking[0].text;
                        }
                        return '';
                    default:
                        return data?.choices?.[0]?.message?.reasoning_content 
                            || data?.choices?.[0]?.message?.reasoning
                            || data?.choices?.[0]?.delta?.reasoning_content
                            || data?.choices?.[0]?.delta?.reasoning
                            || '';
                }
                break;
                
            case 'makersuite':
            case 'gemini':
            case 'vertexai':
                // Vertex AI / Gemini의 thought 필드
                // 실리태번 방식: part.thought가 true이면 그 part의 text가 추론 내용
                // rawData 구조 확인 (callVertexAI에서 반환한 객체)
                
                let allParts = null;
                if (data?.candidates?.[0]?.content?.parts) {
                    allParts = data.candidates[0].content.parts;
                } else if (data?.responseContent?.parts) {
                    allParts = data.responseContent.parts;
                } else if (data?.candidates?.[0]?.parts) {
                    allParts = data.candidates[0].parts;
                }
                
                if (allParts && Array.isArray(allParts)) {
                    // thought가 true인 part만 추출
                    const thoughtParts = allParts
                        .filter(part => {
                            if (typeof part !== 'object' || part === null) return false;
                            // thought가 명시적으로 true인 경우만 추론으로 인정
                            return 'thought' in part && part.thought === true && 'text' in part && part.text;
                        })
                        .map(part => String(part.text));
                    
                    return thoughtParts.join('\n\n');
                }
                break;
                
            case 'openrouter':
                return data?.choices?.[0]?.message?.reasoning 
                    || data?.choices?.[0]?.reasoning 
                    || data?.choices?.[0]?.delta?.reasoning
                    || '';
                    
            case 'mistralai':
            case 'mistral':
                if (data?.choices?.[0]?.message?.content?.[0]?.thinking) {
                    return data.choices[0].message.content[0].thinking
                        .map(part => part.text)
                        .filter(x => x)
                        .join('\n\n');
                }
                if (data?.choices?.[0]?.delta?.content?.[0]?.thinking?.[0]?.text) {
                    return data.choices[0].delta.content[0].thinking[0].text;
                }
                return '';
        }
        
        return '';
    }

    /**
     * 비스트리밍 API 호출
     */
    async callAIWithoutStreaming(apiProvider, options) {
        // API 함수 가져오기
        const apiFunctions = {
            'openai': callOpenAI,
            'claude': callAnthropic,
            'anthropic': callAnthropic,
            'makersuite': callGemini,
            'gemini': callGemini,
            'google': callGemini,
            'vertexai': callVertexAI,
            'openrouter': callOpenRouter,
            'mistralai': callMistral,
            'mistral': callMistral,
            // TODO: 다른 API들 추가
        };

        const apiFunction = apiFunctions[apiProvider];
        if (!apiFunction) {
            throw new Error(`지원하지 않는 API provider: ${apiProvider}`);
        }

        // API별 파라미터 변환
        const apiOptions = { ...options };
        
        // stop vs stopSequences 통일
        if (apiProvider === 'openai') {
            apiOptions.stop = options.stop || [];
        } else {
            apiOptions.stopSequences = options.stop || [];
            delete apiOptions.stop;
        }

        // signal이 aborted 상태면 즉시 중단
        if (apiOptions.signal?.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
        }
        
        const response = await apiFunction({
            ...apiOptions,
            stream: false,
        });

        // 비스트리밍 응답에서 추론 내용 추출
        // response가 문자열이면 그대로 반환, 객체면 추론 내용도 함께 반환
        if (typeof response === 'string') {
            // API 함수가 문자열만 반환하는 경우 (기존 방식 유지)
            return response;
        } else {
            // API 함수가 객체를 반환하는 경우 (추론 내용 포함)
            let text = response.text || response.content || '';
            
            // 추론 추출: response.reasoning이 있으면 우선 사용, 없으면 rawData에서 추출
            let reasoning = null;
            
            // response.reasoning이 있고 실제 추론 내용인지 확인 (빈 문자열이 아니고 'true' 같은 값이 아닌지)
            if (response.reasoning && typeof response.reasoning === 'string' && response.reasoning.trim() && response.reasoning.trim() !== 'true') {
                reasoning = response.reasoning;
            }
            
            // rawData가 있고 reasoning이 없거나 유효하지 않으면 rawData에서 추출 시도
            if ((!reasoning || !reasoning.trim() || reasoning.trim() === 'true') && response.rawData) {
                reasoning = this.extractReasoningFromData(response.rawData, apiProvider, {
                    chatCompletionSource: options.chatCompletionSource || options.chat_completion_source,
                    show_thoughts: options.show_thoughts || options.showThoughts
                });
                
                // 추출된 reasoning이 유효한지 확인 ('true' 같은 잘못된 값 제외)
                if (reasoning && (reasoning.trim() === 'true' || reasoning.trim().length < 10)) {
                    reasoning = null;
                }
            } else if (!reasoning) {
                // rawData도 없으면 response 자체에서 추출 시도
                reasoning = this.extractReasoningFromData(response, apiProvider, {
                    chatCompletionSource: options.chatCompletionSource || options.chat_completion_source,
                    show_thoughts: options.show_thoughts || options.showThoughts
                });
            }
            
            // 추론 내용이 텍스트에 포함되어 있으면 제거
            if (reasoning && reasoning.trim()) {
                const reasoningTrimmed = reasoning.trim();
                if (text.includes(reasoningTrimmed)) {
                    // 모든 위치에서 추론 제거
                    let cleanedText = text;
                    
                    // 시작 부분에서 제거 (반복)
                    while (cleanedText.startsWith(reasoningTrimmed)) {
                        cleanedText = cleanedText.substring(reasoningTrimmed.length).trim();
                    }
                    
                    // 끝 부분에서 제거 (반복)
                    while (cleanedText.endsWith(reasoningTrimmed)) {
                        cleanedText = cleanedText.substring(0, cleanedText.length - reasoningTrimmed.length).trim();
                    }
                    
                    // 중간 부분에서 제거 (모든 발생)
                    cleanedText = cleanedText.split(reasoningTrimmed).join('').trim();
                    
                    text = cleanedText;
                }
            }
            
            // 텍스트가 비어있고 추론만 있는 경우 처리
            // 실리태번과 동일: 추론만 있는 경우 메시지를 표시하지 않거나, 추론을 메시지로 표시하지 않음
            if ((!text || !text.trim()) && reasoning && reasoning.trim()) {
                // 추론만 있는 경우 빈 텍스트로 처리 (추론은 별도로 표시됨)
                // 실리태번과 동일: 추론만 있는 메시지는 표시하지 않음
                text = '';
            }
            
            return {
                text: text,
                reasoning: reasoning,
                rawData: response // 원본 데이터도 함께 반환 (필요시 사용)
            };
        }
    }

    /**
     * 스트리밍 API 호출
     * @param {string} generateType - 생성 타입 ('normal' 또는 'continue')
     */
    async callAIWithStreaming(apiProvider, options, characterName, characterAvatar, generateType = 'normal') {
        // 캐릭터 정보 검증 (디버깅)
        console.log('[ChatManager.callAIWithStreaming] 캐릭터 정보:', {
            characterName,
            currentCharacterId: this.currentCharacterId,
            generateType
        });
        
        // 추론 추출 로그 리셋
        this._reasoningExtractionLogged = false;
        
        // API 함수 가져오기
        const apiFunctions = {
            'openai': callOpenAI,
            'claude': callAnthropic,
            'anthropic': callAnthropic,
            'makersuite': callGemini,
            'gemini': callGemini,
            'google': callGemini,
            'vertexai': callVertexAI,
            'openrouter': callOpenRouter,
            'mistralai': callMistral,
            'mistral': callMistral,
            // TODO: 다른 API들 추가
        };

        const apiFunction = apiFunctions[apiProvider];
        if (!apiFunction) {
            throw new Error(`지원하지 않는 API provider: ${apiProvider}`);
        }

        // 계속하기 모드 확인 및 처리
        let existingMessageWrapper = null;
        let existingMessageText = '';
        let continuePostfix = '';
        
        if (generateType === 'continue') {
            // 실리태번과 동일: 계속하기 시 기존 메시지 찾기
            const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
            for (let i = chatMessages.length - 1; i >= 0; i--) {
                const wrapper = chatMessages[i];
                if (wrapper.dataset.role === 'assistant') {
                    existingMessageWrapper = wrapper;
                    const existingTextElement = wrapper.querySelector('.message-text');
                    if (existingTextElement) {
                        existingMessageText = wrapper.dataset.originalText || existingTextElement.textContent || '';
                    }
                    break;
                }
            }
            
            // continue_postfix 설정 확인 (SettingsStorage - 전역 스코프에서 사용)
            try {
                const settings = await SettingsStorage.load();
                const postfixValue = settings.continue_postfix || '';
                continuePostfix = postfixValue; // '', ' ', '\n', '\n\n'
            } catch (error) {
                // 기본값: 없음
                continuePostfix = '';
            }
        }
        
        // 플레이스홀더 메시지 생성 (계속하기가 아니면 새 메시지, 계속하기면 기존 메시지 사용)
        const placeholderText = '';
        let messageWrapper;
        let messageTextElement;
        
        if (generateType === 'continue' && existingMessageWrapper) {
            // 계속하기: 기존 메시지 사용
            messageWrapper = existingMessageWrapper;
            messageTextElement = messageWrapper.querySelector('.message-text');
            // 기존 텍스트 + postfix로 시작
            fullText = existingMessageText + continuePostfix;
        } else {
            // 새 메시지 생성
            // promptInfo 전달 (스트리밍 모드)
            const promptInfo = options._promptInfo || null;
            messageWrapper = await this.addMessage(placeholderText, 'assistant', characterName, characterAvatar, [], 0, null, null, null, null, promptInfo);
            messageTextElement = messageWrapper.querySelector('.message-text');
            fullText = '';
        }

        let accumulatedFullText = fullText; // 기존 텍스트 + postfix + 새 텍스트
        let accumulatedReasoning = ''; // 추론 내용 누적
        
        // 정규식 함수를 미리 import
        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
        
        // API별 파라미터 변환
        const apiOptions = { ...options };
        
        // stop vs stopSequences 통일
        if (apiProvider === 'openai') {
            apiOptions.stop = options.stop || [];
        } else {
            apiOptions.stopSequences = options.stop || [];
            delete apiOptions.stop;
        }
        
        // signal이 aborted 상태면 즉시 중단
        if (apiOptions.signal?.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
        }
        
        // 추론 내용 업데이트 함수
        const updateReasoningContent = async (reasoningText) => {
            if (!reasoningText || !reasoningText.trim()) return;
            
            const reasoningButton = messageWrapper._reasoningButton;
            const reasoningContent = messageWrapper._reasoningContent;
            
            if (!reasoningButton || !reasoningContent) return;
            
            // 추론 내용에 정규식 적용
            let processedReasoning = reasoningText;
            if (this.currentCharacterId) {
                const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
                const usableMessages = Array.from(chatMessages).filter(wrapper => {
                    const role = wrapper.dataset.role;
                    return role === 'user' || role === 'assistant';
                });
                const depth = usableMessages.length > 0 ? 0 : undefined;
                
                processedReasoning = await getRegexedString(reasoningText, REGEX_PLACEMENT.REASONING, {
                    characterOverride: characterName || undefined,
                    isMarkdown: true,
                    isPrompt: false,
                    depth: depth
                });
            }
            
            // 매크로 치환 적용
            let userName = '';
            try {
                const settings = await SettingsStorage.load();
                const currentPersonaId = settings.currentPersonaId;
                if (currentPersonaId) {
                    const persona = await UserPersonaStorage.load(currentPersonaId);
                    if (persona?.name) {
                        userName = persona.name;
                    }
                }
            } catch (error) {
                // 무시
            }
            processedReasoning = substituteParams(processedReasoning, userName, characterName || '');
            
            // 추론 내용 업데이트 (기존 내용이 있으면 교체, 없으면 추가)
            let reasoningTextElement = reasoningContent.querySelector('.message-reasoning-text');
            if (!reasoningTextElement) {
                reasoningTextElement = document.createElement('div');
                reasoningTextElement.className = 'message-reasoning-text';
                reasoningContent.appendChild(reasoningTextElement);
            }
            
            // 추론 텍스트는 일반 텍스트로 표시 (HTML 렌더링 없음)
            reasoningTextElement.textContent = processedReasoning;
            
            // 추론 버튼 표시
            reasoningButton.style.display = 'inline-block';
        };
        
        await apiFunction({
            ...apiOptions,
            stream: true,
            signal: apiOptions.signal, // AbortSignal 전달
            onChunk: async (chunk, chunkData = null) => {
                // 추론 내용 추출 (chunkData가 있으면 사용, 없으면 chunk에서 추출)
                let reasoningChunk = '';
                if (chunkData) {
                    // 디버깅: chunkData 구조 확인
                    if (accumulatedReasoning.length === 0 && Object.keys(chunkData).length > 0) {
                        console.log('[ChatManager] chunkData 구조 확인:', {
                            apiProvider,
                            chunkDataKeys: Object.keys(chunkData),
                            chunkDataType: chunkData.type || 'unknown',
                            hasDelta: !!chunkData.delta,
                            hasChoices: !!chunkData.choices,
                            chunkDataPreview: JSON.stringify(chunkData).substring(0, 200)
                        });
                    }
                    
                    reasoningChunk = this.extractReasoningFromData(chunkData, apiProvider, {
                        chatCompletionSource: options.chatCompletionSource || options.chat_completion_source,
                        show_thoughts: options.show_thoughts || options.showThoughts
                    });
                    if (reasoningChunk && reasoningChunk.trim()) {
                        accumulatedReasoning += reasoningChunk;
                        await updateReasoningContent(accumulatedReasoning);
                    }
                } else if (chunk) {
                    // chunkData가 없고 chunk만 있는 경우, chunk에 추론이 포함되어 있을 수 있음
                    // 특정 패턴으로 추론을 찾아보기 (예: "Right, time to get to work" 같은 패턴)
                    // 하지만 이건 추론이 텍스트에 포함된 경우이므로, 실제로는 API 응답 구조를 확인해야 함
                }
                
                // 중단 신호 확인 (매 청크마다 체크)
                if (apiOptions.signal?.aborted) {
                    throw new DOMException('The operation was aborted.', 'AbortError');
                }
                
                // 추론 내용은 청크 단위로 오므로 청크 단위로 제거하기 어려움
                // 스트리밍 완료 후 전체 텍스트에서 누적된 추론 내용을 제거하는 방식 사용
                // 여기서는 청크를 그대로 누적 (추론은 별도로 수집)
                accumulatedFullText += chunk;
                // fullText는 새로 생성된 텍스트만 (기존 텍스트 제외, 추론도 제외)
                fullText = accumulatedFullText.substring(existingMessageText.length + continuePostfix.length);
                // 실시간으로 텍스트 업데이트
                if (messageTextElement) {
                    // 실리태번과 동일: 스트리밍 중에도 depth 계산하여 정규식 적용
                    const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
                    const usableMessages = Array.from(chatMessages).filter(wrapper => {
                        const role = wrapper.dataset.role;
                        return role === 'user' || role === 'assistant';
                    });
                    const depth = usableMessages.length > 0 ? 0 : undefined; // 스트리밍 중인 메시지는 가장 최근이므로 depth 0
                    
                    // 계속하기 모드: 전체 텍스트 (기존 + postfix + 새 텍스트) 처리
                    // 스트리밍 중에도 추론 내용이 텍스트에 포함되어 있으면 제거하여 표시
                    let textToProcess = generateType === 'continue' ? accumulatedFullText : fullText;
                    
                    // 스트리밍 중에도 누적된 추론 내용이 텍스트에 포함되어 있으면 제거
                    if (accumulatedReasoning && accumulatedReasoning.trim()) {
                        const reasoningTrimmed = accumulatedReasoning.trim();
                        if (textToProcess.includes(reasoningTrimmed)) {
                            // 모든 위치에서 추론 제거
                            let cleanedText = textToProcess;
                            
                            // 시작 부분에서 제거
                            while (cleanedText.startsWith(reasoningTrimmed)) {
                                cleanedText = cleanedText.substring(reasoningTrimmed.length).trim();
                            }
                            
                            // 끝 부분에서 제거
                            while (cleanedText.endsWith(reasoningTrimmed)) {
                                cleanedText = cleanedText.substring(0, cleanedText.length - reasoningTrimmed.length).trim();
                            }
                            
                            // 중간 부분에서 제거 (모든 발생)
                            cleanedText = cleanedText.split(reasoningTrimmed).join('').trim();
                            
                            textToProcess = cleanedText;
                        }
                    }
                    
                    const processed = await getRegexedString(textToProcess, REGEX_PLACEMENT.AI_OUTPUT, {
                        characterOverride: characterName || undefined, // 실리태번과 동일: 캐릭터 이름 전달
                        isMarkdown: true,
                        isPrompt: false,
                        depth: depth
                    });
                    // {{user}}, {{char}} 매크로 치환 적용 (스트리밍 중)
                    // substituteParams - 전역 스코프에서 사용
                    let userName = '';
                    try {
                        // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
                        const settings = await SettingsStorage.load();
                        const currentPersonaId = settings.currentPersonaId;
                        if (currentPersonaId) {
                            const persona = await UserPersonaStorage.load(currentPersonaId);
                            if (persona?.name) {
                                userName = persona.name;
                            }
                        }
                    } catch (error) {
                        // 무시
                    }
                    const processedWithMacros = substituteParams(processed, userName, characterName || '');
                    messageTextElement.innerHTML = messageFormatting(processedWithMacros, userName, characterName || '');
                    this.renderHtmlIframesInElement(messageTextElement);
                    this.scrollToBottom();
                }
            },
        });

        // 최종 원본 텍스트 저장 (추론 내용 제외)
        // 계속하기 모드: 전체 텍스트 (기존 + postfix + 새 텍스트) 저장
        let finalText = generateType === 'continue' ? accumulatedFullText : fullText;
        
        // 최종적으로 추론 내용이 텍스트에 남아있는지 확인하고 제거
        // (일부 API는 추론을 별도 필드와 텍스트에 모두 포함시킬 수 있음)
        if (accumulatedReasoning && accumulatedReasoning.trim()) {
            // 추론 내용이 텍스트에 포함되어 있으면 제거
            const reasoningTrimmed = accumulatedReasoning.trim();
            
            if (finalText.includes(reasoningTrimmed)) {
                // 모든 위치에서 추론 제거
                let cleanedText = finalText;
                
                // 시작 부분에서 제거 (반복)
                while (cleanedText.startsWith(reasoningTrimmed)) {
                    cleanedText = cleanedText.substring(reasoningTrimmed.length).trim();
                }
                
                // 끝 부분에서 제거 (반복)
                while (cleanedText.endsWith(reasoningTrimmed)) {
                    cleanedText = cleanedText.substring(0, cleanedText.length - reasoningTrimmed.length).trim();
                }
                
                // 중간 부분에서 제거 (모든 발생)
                cleanedText = cleanedText.split(reasoningTrimmed).join('').trim();
                
                finalText = cleanedText;
            }
            
            await updateReasoningContent(accumulatedReasoning);
            
            // messageObject에 추론 내용 저장
            const messageIndex = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper')).indexOf(messageWrapper);
            if (messageIndex >= 0 && this.chat[messageIndex]) {
                if (!this.chat[messageIndex].extra) {
                    this.chat[messageIndex].extra = {};
                }
                this.chat[messageIndex].extra.reasoning = accumulatedReasoning;
            }
        }
        
        messageWrapper.dataset.originalText = finalText;

        return finalText;
    }

    /**
     * 메시지 추가
     * @param {string} text - 메시지 텍스트
     * @param {string} sender - 발신자 ('user' 또는 'assistant')
     * @param {string} characterName - 캐릭터 이름 (assistant일 때 사용)
     * @param {string} characterAvatar - 캐릭터 아바타 이미지 (assistant일 때 사용)
     * @param {Array<string>} swipes - 스와이프 가능한 대안 응답 배열 (assistant일 때 사용)
     * @param {number} swipeIndex - 현재 표시할 스와이프 인덱스 (기본값: 0)
     */
    async addMessage(text, sender, characterName = null, characterAvatar = null, swipes = [], swipeIndex = 0, userAvatar = null, sendDate = null, reasoning = null, originalUserName = null, promptInfo = null) {
        // 사용자 이름과 캐릭터 이름 가져오기 (매크로 치환용)
        let userName = '';
        let charName = characterName || '';
        
        try {
            // CharacterStorage - 전역 스코프에서 사용
            // UserPersonaStorage - 전역 스코프에서 사용
            // SettingsStorage - 전역 스코프에서 사용
            
            // 캐릭터 이름이 없으면 현재 선택된 캐릭터에서 가져오기
            if (!charName) {
                const currentCharacterId = await CharacterStorage.loadCurrent();
                if (currentCharacterId) {
                    const character = await CharacterStorage.load(currentCharacterId);
                    if (character?.data?.name || character?.name) {
                        charName = character.data?.name || character.name;
                    }
                }
            }
            
            // 사용자 이름 가져오기
            // ⚠️ 중요: originalUserName이 있으면 원본 이름 사용 (불러온 채팅의 원본 이름 보존)
            // originalUserName이 없으면 현재 페르소나 이름 사용 (새 메시지)
            if (originalUserName !== null && originalUserName !== undefined) {
                userName = originalUserName;
            } else {
                const settings = await SettingsStorage.load();
                const currentPersonaId = settings.currentPersonaId;
                if (currentPersonaId) {
                    const persona = await UserPersonaStorage.load(currentPersonaId);
                    if (persona?.name) {
                        userName = persona.name;
                    }
                }
            }
        } catch (error) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20009', '사용자/캐릭터 정보 로드 실패', error);
            }
        }
        
        // HTML 코드 블록을 먼저 추출하여 정규식과 매크로 치환이 내부를 건드리지 않도록 보호
        const htmlBlocksBeforeProcessing = processHtmlCodeBlocks(text);
        const textWithoutHtmlBlocks = typeof htmlBlocksBeforeProcessing === 'string' ? htmlBlocksBeforeProcessing : htmlBlocksBeforeProcessing.text;
        const extractedHtmlBlocks = typeof htmlBlocksBeforeProcessing === 'object' && htmlBlocksBeforeProcessing.htmlBlocks ? htmlBlocksBeforeProcessing.htmlBlocks : [];
        
        // 실리태번과 동일: 메시지 표시 시 정규식 적용 (isMarkdown: true, depth 계산)
        // HTML 코드 블록을 제외한 텍스트에만 정규식 적용
        // 홈 화면이거나 채팅이 없는 상태에서는 정규식 실행하지 않음
        let processedText = textWithoutHtmlBlocks;
        if ((sender === 'assistant' || sender === 'user') && this.currentCharacterId) {
            // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
            
            // 실리태번과 동일: depth 계산 (usableMessages.length - indexOf - 1)
            const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
            const usableMessages = Array.from(chatMessages).filter(wrapper => {
                const role = wrapper.dataset.role;
                return role === 'user' || role === 'assistant';
            });
            const currentIndex = usableMessages.length; // 현재 추가할 메시지의 인덱스 (추가 전이므로 length가 인덱스)
            const depth = usableMessages.length > 0 ? 0 : undefined; // 가장 최근 메시지는 depth 0
            
            // 실리태번과 동일: 메시지 표시는 isMarkdown: true, characterOverride 전달
            const placement = sender === 'user' ? REGEX_PLACEMENT.USER_INPUT : REGEX_PLACEMENT.AI_OUTPUT;
            processedText = await getRegexedString(textWithoutHtmlBlocks, placement, {
                characterOverride: charName || undefined, // 실리태번과 동일: AI 출력 시 캐릭터 이름 전달
                isMarkdown: true,
                isPrompt: false,
                depth: depth
            });
        }
        
        // {{user}}, {{char}} 매크로 치환 적용 (정규식 적용 후, HTML 블록 제외 텍스트에만)
        // substituteParams - 전역 스코프에서 사용
        processedText = substituteParams(processedText, userName, charName);
        
        // HTML 코드 블록 내부의 매크로 치환 (원본 HTML 블록에 적용)
        if (extractedHtmlBlocks.length > 0) {
            extractedHtmlBlocks.forEach((block) => {
                block.html = substituteParams(block.html, userName, charName);
            });
        }
        
        // HTML 코드 블록을 다시 코드 블록 형태로 복원하여 processedText에 추가
        // 주의: 마커를 코드 블록으로 복원하면 messageFormatting에서 다시 추출됨
        if (extractedHtmlBlocks.length > 0) {
            extractedHtmlBlocks.forEach((block) => {
                const marker = `<!-- HTML_IFRAME_MARKER:${block.id} -->`;
                const codeBlock = `\`\`\`html\n${block.html}\n\`\`\``;
                processedText = processedText.replace(marker, codeBlock);
            });
        }
        
        // 메시지 래퍼 생성 (스와이프 기능용)
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        // 역할 저장 (getChatHistory에서 사용)
        messageWrapper.dataset.role = sender;
        
        // 원본 텍스트 저장 (편집용) - 정규식 적용 전 원본
        messageWrapper.dataset.originalText = text;
        
        // 실리태번과 동일: 메시지 고유 ID 및 send_date 추가 (순서 보장용)
        // uuidv4 - 전역 스코프에서 사용
        const messageUuid = uuidv4();
        // sendDate 파라미터가 있으면 사용, 없으면 현재 시간 사용
        const messageSendDate = sendDate || Date.now();
        messageWrapper.dataset.messageUuid = messageUuid;
        messageWrapper.dataset.sendDate = messageSendDate.toString();
        
        // 실리태번과 동일: 캐릭터 이름 저장 (characterOverride용)
        if (sender === 'assistant' && characterName) {
            messageWrapper.dataset.characterName = characterName;
        }
        
        // 페르소나 아바타 저장 (유저 메시지에만)
        if (sender === 'user' && userAvatar) {
            messageWrapper.dataset.forceAvatar = userAvatar;
        }
        
        // 스와이프 데이터 저장 (assistant 메시지는 항상 저장)
        if (sender === 'assistant') {
            const allSwipes = swipes.length > 0 ? [processedText, ...swipes] : [processedText];
            messageWrapper.dataset.swipes = JSON.stringify(allSwipes);
            messageWrapper.dataset.swipeIndex = swipeIndex.toString();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        // 아바타에 이니셜 또는 이미지 표시
        if (sender === 'user') {
            // 페르소나 아바타가 있으면 표시 (실리태번과 동일: force_avatar)
            let userAvatarToUse = userAvatar || messageWrapper.dataset.forceAvatar;
            
            // userAvatarToUse가 파일명 형식인 경우 페르소나를 찾아서 실제 아바타 URL로 변환
            if (userAvatarToUse && !userAvatarToUse.startsWith('data:') && !userAvatarToUse.startsWith('http://') && !userAvatarToUse.startsWith('https://')) {
                // 파일명 형식인지 확인 (예: 1758292739003-.png)
                const isFilename = /^[\d\w]+[-_\.][\w\.]+$/.test(userAvatarToUse) || userAvatarToUse.includes('.png') || userAvatarToUse.includes('.jpg') || userAvatarToUse.includes('.jpeg');
                
                if (isFilename) {
                    // 파일명으로 페르소나 찾기 시도
                    try {
                        const allPersonas = await UserPersonaStorage.loadAll();
                        let foundPersona = null;
                        
                        // 파일명에서 확장자 제거하고 숫자 부분 추출
                        const filenameWithoutExt = userAvatarToUse.replace(/\.(png|jpg|jpeg)$/i, '');
                        
                        // 1. 파일명과 일치하는 페르소나 찾기 (avatar 필드가 파일명과 일치)
                        for (const [personaId, persona] of Object.entries(allPersonas)) {
                            if (persona?.avatar) {
                                // persona.avatar가 Data URL인 경우 파일명 추출 시도
                                const avatarMatch = persona.avatar.match(/thumbnail[^"]*file=([^&"']+)/);
                                if (avatarMatch && avatarMatch[1] === userAvatarToUse) {
                                    foundPersona = persona;
                                    break;
                                }
                                // 또는 avatar에 파일명이 포함된 경우
                                if (persona.avatar.includes(userAvatarToUse) || persona.avatar.includes(filenameWithoutExt)) {
                                    foundPersona = persona;
                                    break;
                                }
                            }
                        }
                        
                        // 2. 파일명을 찾지 못하면 페르소나 ID로 찾기 시도
                        if (!foundPersona && filenameWithoutExt) {
                            for (const [personaId, persona] of Object.entries(allPersonas)) {
                                if (personaId.includes(filenameWithoutExt) || filenameWithoutExt.includes(personaId)) {
                                    foundPersona = persona;
                                    break;
                                }
                            }
                        }
                        
                        // 페르소나를 찾았고 아바타가 Data URL이면 사용
                        if (foundPersona && foundPersona.avatar && (foundPersona.avatar.startsWith('data:') || foundPersona.avatar.startsWith('http://') || foundPersona.avatar.startsWith('https://'))) {
                            userAvatarToUse = foundPersona.avatar;
                            console.debug('[ChatManager.addMessage] 파일명으로 페르소나 아바타 찾음:', {
                                originalFilename: messageWrapper.dataset.forceAvatar || userAvatar,
                                personaName: foundPersona.name,
                                foundAvatar: foundPersona.avatar.substring(0, 50)
                            });
                        } else {
                            // 페르소나를 찾지 못했거나 아바타가 없으면 null로 설정 (기본 아이콘 사용)
                            userAvatarToUse = null;
                        }
                    } catch (e) {
                        console.debug('[ChatManager.addMessage] 파일명으로 페르소나 찾기 실패, 기본 아이콘 사용:', e);
                        userAvatarToUse = null;
                    }
                } else {
                    // 파일명 형식이 아니면 페르소나 이름으로 찾기 시도 (기존 로직)
                    try {
                        const allPersonas = await UserPersonaStorage.loadAll();
                        let foundPersona = null;
                        for (const [personaId, persona] of Object.entries(allPersonas)) {
                            if (persona?.name === userAvatarToUse || personaId === userAvatarToUse) {
                                foundPersona = persona;
                                break;
                            }
                        }
                        if (foundPersona && foundPersona.avatar) {
                            userAvatarToUse = foundPersona.avatar;
                        } else {
                            userAvatarToUse = null;
                        }
                    } catch (e) {
                        console.debug('[ChatManager.addMessage] 페르소나 이름으로 찾기 실패, 기본 아이콘 사용:', e);
                        userAvatarToUse = null;
                    }
                }
            }
            
            if (userAvatarToUse) {
                const avatarImg = document.createElement('img');
                avatarImg.src = userAvatarToUse;
                avatarImg.alt = 'User';
                avatarImg.style.width = '100%';
                avatarImg.style.height = '100%';
                avatarImg.style.objectFit = 'cover';
                avatarImg.style.borderRadius = '50%';
                avatarImg.onerror = () => {
                    avatarImg.remove();
                    const userIcon = document.createElement('i');
                    userIcon.className = 'fa-solid fa-user';
                    userIcon.style.fontSize = '1.5em';
                    avatar.appendChild(userIcon);
                };
                avatar.appendChild(avatarImg);
            } else {
                // Font Awesome 사용자 아이콘 표시
                const userIcon = document.createElement('i');
                userIcon.className = 'fa-solid fa-user';
                userIcon.style.fontSize = '1.5em';
                avatar.appendChild(userIcon);
            }
        } else {
            // 캐릭터 이미지가 있으면 표시
            if (characterAvatar) {
                // 먼저 Font Awesome 아이콘 표시 (이미지 로드 전까지)
                const placeholderIcon = document.createElement('i');
                placeholderIcon.className = 'fa-solid fa-user';
                placeholderIcon.style.fontSize = '1.5em';
                avatar.appendChild(placeholderIcon);
                
                const avatarImg = document.createElement('img');
                avatarImg.alt = characterName || 'Character';
                avatarImg.style.width = '100%';
                avatarImg.style.height = '100%';
                avatarImg.style.objectFit = 'cover';
                avatarImg.style.borderRadius = '50%';
                avatarImg.style.position = 'absolute';
                avatarImg.style.top = '0';
                avatarImg.style.left = '0';
                avatarImg.style.opacity = '0';
                avatarImg.style.transition = 'opacity 0.2s ease';
                
                // 로드 성공 핸들러
                avatarImg.onload = () => {
                    // 이미지가 성공적으로 로드되면 표시
                    avatarImg.style.opacity = '1';
                    // 아이콘 숨기기 (이미지 위에 덮임)
                    if (placeholderIcon.parentNode === avatar) {
                        placeholderIcon.remove();
                    }
                };
                
                // 로드 실패 핸들러
                avatarImg.onerror = () => {
                    // 이미지 로드 실패 시 이미지 제거하고 아이콘만 표시
                    avatarImg.remove();
                    // 아이콘이 이미 있으면 그대로 유지
                };
                
                // 이미지 요소 추가
                avatar.appendChild(avatarImg);
                
                // 이미지 소스 설정 (onload/onerror 핸들러가 설정된 후)
                avatarImg.src = characterAvatar;
            } else {
                // 이미지가 없으면 Font Awesome 사용자 아이콘 표시
                const userIcon = document.createElement('i');
                userIcon.className = 'fa-solid fa-user';
                userIcon.style.fontSize = '1.5em';
                avatar.appendChild(userIcon);
            }
        }

        const content = document.createElement('div');
        content.className = 'message-content';

        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        // messageFormatting은 항상 iframe을 생성합니다. 제한 적용은 DOM 추가 후에 처리합니다.
        messageText.innerHTML = messageFormatting(processedText, userName, charName);

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        
        // 날짜와 시간 포맷팅 함수
        const formatDateTime = (timestamp) => {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${year}년 ${month}월 ${day}일 ${hour}:${minute}`;
        };
        
        // send_date가 있으면 사용, 없으면 현재 시간 사용
        const messageTimestamp = messageSendDate || Date.now();
        messageTime.textContent = formatDateTime(messageTimestamp);

        content.appendChild(messageText);
        
        // 메시지 이름 생성
        const messageName = document.createElement('div');
        messageName.className = 'message-name';
        if (sender === 'user') {
            // ⚠️ 중요: originalUserName이 있으면 원본 이름 사용 (불러온 채팅의 원본 이름 보존)
            // originalUserName이 없으면 현재 페르소나 이름 사용 (새 메시지)
            messageName.textContent = userName || 'User';
            // 원본 이름을 dataset에 저장 (saveChat에서 읽기 위해)
            if (originalUserName !== null && originalUserName !== undefined) {
                messageWrapper.dataset.originalUserName = originalUserName;
            }
        } else {
            // 캐릭터 이름 사용 (다른 캐릭터인 경우에도 올바른 이름 표시)
            messageName.textContent = charName || 'Character';
        }
        
        // 추론 버튼 추가 (assistant 메시지에만, 추론 내용이 있을 때만 표시)
        const reasoningButton = document.createElement('button');
        reasoningButton.className = 'message-reasoning-button';
        reasoningButton.setAttribute('aria-label', '추론 내용 보기');
        reasoningButton.innerHTML = '<i class="fa-solid fa-comment-dots"></i>';
        reasoningButton.style.display = 'none'; // 기본적으로 숨김, 추론 내용이 있으면 표시 (CSS에서 관리)
        
        // 추론 내용 div 생성 (message-content 위에)
        const reasoningContent = document.createElement('div');
        reasoningContent.className = 'message-reasoning-content';
        reasoningContent.style.display = 'none'; // 기본적으로 숨김 (CSS에서 관리, JavaScript에서 토글)
        
        // 버튼 클릭 시 추론 내용 토글
        let isReasoningVisible = false;
        reasoningButton.addEventListener('click', (e) => {
            e.stopPropagation();
            isReasoningVisible = !isReasoningVisible;
            reasoningContent.style.display = isReasoningVisible ? 'block' : 'none';
            // 버튼 활성 상태 토글 (CSS에서 관리)
            if (isReasoningVisible) {
                reasoningButton.classList.add('active');
            } else {
                reasoningButton.classList.remove('active');
            }
        });
        
        // 이름과 추론 버튼을 묶는 컨테이너 생성
        const nameReasoningContainer = document.createElement('div');
        nameReasoningContainer.className = 'message-name-reasoning-container';
        nameReasoningContainer.appendChild(messageName);
        nameReasoningContainer.appendChild(reasoningButton);
        
        // 아바타와 이름+버튼을 묶는 컨테이너 생성
        const avatarNameContainer = document.createElement('div');
        avatarNameContainer.className = 'message-avatar-name';
        avatarNameContainer.appendChild(avatar);
        avatarNameContainer.appendChild(nameReasoningContainer);
        
        // 메시지 헤더 생성 (아바타+이름 + 시간)
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.appendChild(avatarNameContainer);
        messageHeader.appendChild(messageTime);

        messageDiv.appendChild(messageHeader);
        // 추론 내용을 message-content 위에 추가
        messageDiv.appendChild(reasoningContent);
        messageDiv.appendChild(content); // message-content는 message-header 밖에
        
        messageWrapper.appendChild(messageDiv);
        
        // 추론 버튼과 추론 내용 요소를 messageWrapper에 저장 (나중에 업데이트하기 위해)
        messageWrapper._reasoningButton = reasoningButton;
        messageWrapper._reasoningContent = reasoningContent;
        
        // 편집/삭제 버튼 생성 함수
        const createActionButtons = () => {
            const actionButtons = document.createElement('div');
            actionButtons.className = 'message-action-buttons';
            
            // 문서 아이콘 버튼 (맨 왼쪽)
            const documentBtn = document.createElement('button');
            documentBtn.className = 'message-action-btn message-document-btn';
            documentBtn.innerHTML = '<i class="fa-solid fa-file"></i>';
            documentBtn.setAttribute('aria-label', '프롬프트 정보');
            documentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPromptInfoModal(messageWrapper);
            });
            
            const editBtn = document.createElement('button');
            editBtn.className = 'message-action-btn message-edit-btn';
            editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            editBtn.setAttribute('aria-label', '메시지 편집');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMessage(messageWrapper);
            });
            
            // 재생성 버튼 (assistant 메시지에만)
            let regenerateBtn = null;
            if (sender === 'assistant') {
                regenerateBtn = document.createElement('button');
                regenerateBtn.className = 'message-action-btn message-regenerate-btn';
                regenerateBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-right"></i>';
                regenerateBtn.setAttribute('aria-label', '재생성');
                regenerateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.regenerateMessage(messageWrapper);
                });
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'message-action-btn message-delete-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.setAttribute('aria-label', '메시지 삭제');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMessage(messageWrapper);
            });
            
            // 버튼 추가 순서: 문서 버튼이 맨 왼쪽
            actionButtons.appendChild(documentBtn);
            if (regenerateBtn) {
                actionButtons.appendChild(regenerateBtn);
            }
            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);
            return actionButtons;
        };
        
        // assistant 메시지는 항상 스와이프 컨트롤 추가 (메시지가 1개인 경우에도 1/1 표시)
        if (sender === 'assistant') {
            // assistant 메시지 클래스 추가
            messageWrapper.classList.add('assistant-message');
            
            // swipes 배열이 없으면 빈 배열로 초기화 (현재 메시지만 있는 상태)
            const allSwipes = swipes.length > 0 ? [text, ...swipes] : [text];
            
            const swipeControls = document.createElement('div');
            swipeControls.className = 'message-swipe-controls';
            
            const swipeLeftBtn = document.createElement('button');
            swipeLeftBtn.className = 'swipe-btn swipe-left';
            swipeLeftBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            swipeLeftBtn.setAttribute('aria-label', '이전 응답');
            swipeLeftBtn.disabled = swipeIndex === 0;
            
            const swipeIndicator = document.createElement('span');
            swipeIndicator.className = 'swipe-indicator';
            swipeIndicator.textContent = `${swipeIndex + 1}/${allSwipes.length}`;
            
            const swipeRightBtn = document.createElement('button');
            swipeRightBtn.className = 'swipe-btn swipe-right';
            swipeRightBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            swipeRightBtn.setAttribute('aria-label', '다음 응답');
            // 다음 버튼은 항상 활성화 (새 스와이프 생성 가능)
            
            swipeControls.appendChild(swipeLeftBtn);
            swipeControls.appendChild(swipeIndicator);
            swipeControls.appendChild(swipeRightBtn);
            
            // 컨트롤 영역 생성 (스와이프 + 액션 버튼을 같은 줄에)
            const controlsRow = document.createElement('div');
            controlsRow.className = 'message-controls-row';
            controlsRow.appendChild(swipeControls);
            
            // 편집/삭제 버튼 추가
            const actionButtons = createActionButtons();
            controlsRow.appendChild(actionButtons);
            
            // 컨트롤 영역을 messageDiv에 추가
            messageDiv.appendChild(controlsRow);
            
            // 스와이프 버튼 이벤트 리스너
            swipeLeftBtn.addEventListener('click', () => {
                this.swipeMessage(messageWrapper, -1);
            });
            
            swipeRightBtn.addEventListener('click', () => {
                this.swipeMessage(messageWrapper, 1);
            });
            
            // assistant 메시지에 스와이프 제스처 추가
            this.setupSwipeGestures(messageWrapper, messageDiv);
        } else {
            // 스와이프가 없는 경우 일반 위치에 버튼 추가
            // 유저 메시지인 경우 클래스 추가
            if (sender === 'user') {
                messageWrapper.classList.add('user-message');
            }
            // 컨트롤 영역 생성 (오른쪽 정렬)
            const controlsRow = document.createElement('div');
            controlsRow.className = 'message-controls-row';
            controlsRow.style.justifyContent = 'flex-end'; // 오른쪽 정렬
            
            const actionButtons = createActionButtons();
            controlsRow.appendChild(actionButtons);
            messageDiv.appendChild(controlsRow);
        }

        // 환영 메시지 제거
        const welcomeMsg = this.elements.chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        this.elements.chatMessages.appendChild(messageWrapper);
        
        // 실리태번과 동일: this.chat 배열에도 메시지 추가 (동기화)
        // addMessage에서 메시지를 추가할 때마다 chat 배열에 추가하여 단일 소스로 유지
        // 단, 로딩 중이거나 저장 중일 때는 건너뛰기 (중복 방지)
        let messageObject = null; // 추론 저장을 위해 스코프 밖에서 선언
        if (!this._isLoadingChat && !this._isLoadingMoreMessages && !this._isSavingChat) {
            messageObject = {
                uuid: messageUuid,
                send_date: messageSendDate,
                name: sender === 'user' ? (userName || 'User') : (charName || 'Character'),
                is_user: sender === 'user',
                is_system: false,
                mes: text, // 원본 텍스트 (processedText가 아닌)
                extra: {
                    swipes: sender === 'assistant' && swipes.length > 0 ? swipes : [],
                    promptInfo: promptInfo || null, // 프롬프트 정보 저장
                },
            };
            
            // force_avatar 추가 (유저 메시지에만)
            if (sender === 'user' && userAvatar) {
                messageObject.force_avatar = userAvatar;
            }
            
            // 실리태번과 동일: chat 배열에 추가 (send_date 기준으로 정렬된 위치에 삽입)
            let insertIndex = this.chat.length;
            for (let i = 0; i < this.chat.length; i++) {
                if ((this.chat[i].send_date || 0) > messageSendDate) {
                    insertIndex = i;
                    break;
                }
            }
            this.chat.splice(insertIndex, 0, messageObject);
        } else {
            // 로딩 중이거나 저장 중일 때도 추론을 저장하기 위해 messageObject 찾기
            // this.chat 배열에서 UUID로 찾기
            messageObject = this.chat.find(msg => msg.uuid === messageUuid);
        }
        
        // HTML 렌더링 제한 적용: 로딩 중이 아닐 때만 개별 체크 (로딩 중이면 나중에 일괄 적용)
        // loadChat 중에는 모든 메시지가 추가된 후 일괄 적용되므로 여기서는 스킵
        if (!this._isLoadingChat && !this._isLoadingMoreMessages) {
        // DOM 업데이트 완료 대기
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        try {
            const settings = await SettingsStorage.load();
            const htmlRenderLimit = settings.htmlRenderLimit ?? 0;
            
            if (htmlRenderLimit > 0) {
                    // 모든 표시된 메시지 가져오기 (새 메시지 포함)
                    const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                    .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
                    
                    // 역순 인덱스 계산: 최근 메시지가 인덱스 0, 1, 2...
                    // 배열을 역순으로 순회 (최근 메시지부터)
                    const reversedWrappers = [...allMessageWrappers].reverse();
                    
                    reversedWrappers.forEach((wrapper, reverseIndex) => {
                        // reverseIndex가 0이면 최근 메시지 (새로 추가된 메시지), 1이면 그 다음 최근 메시지...
                        const messageTextElement = wrapper.querySelector('.message-text');
                        
                        if (messageTextElement) {
                            if (reverseIndex >= htmlRenderLimit) {
                                // 제한 범위를 벗어난 메시지는 플레이스홀더로 교체
                                this.renderHtmlIframesInElement(messageTextElement, true);
                            } else {
                                // 제한 범위 내의 메시지는 렌더링 (플레이스홀더가 있으면 복원)
                                this.renderHtmlIframesInElement(messageTextElement, false);
                            }
                        }
                    });
                } else {
                    // htmlRenderLimit이 0이면 모든 메시지 렌더링
                    this.renderHtmlIframesInElement(messageText, false);
            }
        } catch (error) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20010', 'HTML 렌더링 제한 확인 실패 (addMessage)', error);
            }
                // 오류 시 기본적으로 렌더링
                this.renderHtmlIframesInElement(messageText, false);
            }
        } else {
            // 로딩 중일 때는 기본적으로 렌더링 (나중에 일괄 적용될 것)
            // 단, 이미 iframe이 생성되었으므로 일단 렌더링
            this.renderHtmlIframesInElement(messageText, false);
        }
        
        // 스크롤을 맨 아래로 (더보기 로딩 중이 아닐 때만)
        // 더보기 로딩 중에는 스크롤 위치를 유지해야 함
        if (!this._isLoadingMoreMessages) {
            this.scrollToBottom();
        }
        
        // 추론 내용 처리 (assistant 메시지에만)
        if (sender === 'assistant' && reasoning && reasoning.trim()) {
            // 추론 내용에 정규식 적용 (REASONING placement)
            let processedReasoning = reasoning;
            if (this.currentCharacterId) {
                const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
                const usableMessages = Array.from(chatMessages).filter(wrapper => {
                    const role = wrapper.dataset.role;
                    return role === 'user' || role === 'assistant';
                });
                const depth = usableMessages.length > 0 ? 0 : undefined;
                
                processedReasoning = await getRegexedString(reasoning, REGEX_PLACEMENT.REASONING, {
                    characterOverride: charName || undefined,
                    isMarkdown: true,
                    isPrompt: false,
                    depth: depth
                });
            }
            
            // 매크로 치환 적용
            processedReasoning = substituteParams(processedReasoning, userName, charName);
            
            // 추론 내용 렌더링 (일반 텍스트, HTML 렌더링 없음)
            const reasoningText = document.createElement('div');
            reasoningText.className = 'message-reasoning-text';
            reasoningText.textContent = processedReasoning;
            
            // 추론 내용 div에 추가
            reasoningContent.appendChild(reasoningText);
            
            // 추론 버튼 표시
            reasoningButton.style.display = 'inline-block';
            
            // messageObject에 추론 내용 저장
            if (messageObject) {
                if (!messageObject.extra) {
                    messageObject.extra = {};
                }
                messageObject.extra.reasoning = reasoning;
            }
            
            // DOM에도 추론 저장 (saveChat에서 읽기 위해)
            // 원본 추론 텍스트를 dataset에 저장 (처리 전 원본)
            if (reasoning && reasoning.trim()) {
                messageWrapper.dataset.reasoning = reasoning;
            }
        }
        
        // 메시지 추가 후 자동 저장 (디바운스)
        // 더보기 로딩 중이거나 채팅 로딩 중이면 저장하지 않음 (중복 방지)
        if (!this._isLoadingMoreMessages && !this._isLoadingChat) {
            console.debug('[addMessage] 저장 시작 (saveChatDebounced 호출)');
            // 백그라운드 탭에서도 작동하도록 비동기로 실행 (await 없이)
            // saveChatDebounced 내부에서 백그라운드 감지하여 즉시 저장함
            this.saveChatDebounced().catch((error) => {
                console.error('[addMessage] saveChatDebounced 중 오류:', error);
            });
        } else {
            console.debug('[addMessage] 저장 건너뜀:', {
                _isLoadingMoreMessages: this._isLoadingMoreMessages,
                _isLoadingChat: this._isLoadingChat
            });
        }
        
        // 메시지 추가 후 전송 버튼 상태 업데이트 (나중에 실행, 백그라운드에서도 작동)
        Promise.resolve().then(() => {
            this.updateSendButtonState();
        }).catch((error) => {
            console.debug('[addMessage] updateSendButtonState 중 오류 (무시):', error);
        });
        
        return messageWrapper;
    }

    /**
     * 현재 채팅의 모든 메시지 아바타 업데이트
     * 캐릭터 또는 페르소나 프로필 이미지 변경 시 호출
     */
    async updateAllMessageAvatars() {
        if (!this.currentCharacterId) {
            return;
        }

        // 캐릭터 정보 가져오기
        // CharacterStorage - 전역 스코프에서 사용
        const character = await CharacterStorage.load(this.currentCharacterId);
        if (!character) {
            return;
        }

        const characterAvatar = character?.avatar_image || 
                               character?.avatarImage || 
                               character?.data?.avatar_image ||
                               character?.data?.avatarImage ||
                               (character?.avatar && character.avatar !== 'none' ? character.avatar : null) ||
                               null;

        // 페르소나 정보 가져오기
        // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
        const settings = await SettingsStorage.load();
        const currentPersonaId = settings.currentPersonaId;
        let userAvatar = null;
        if (currentPersonaId) {
            const persona = await UserPersonaStorage.load(currentPersonaId);
            if (persona && persona.avatar) {
                userAvatar = persona.avatar;
            }
        }

        // 모든 메시지 래퍼 찾기
        const messageWrappers = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        
        messageWrappers.forEach(wrapper => {
            const isUser = wrapper.dataset.role === 'user';
            const avatar = wrapper.querySelector('.message-avatar');
            if (!avatar) return;

            // 기존 내용 제거
            avatar.innerHTML = '';

            if (isUser) {
                // 사용자 메시지: 페르소나 아바타 업데이트
                if (userAvatar) {
                    const placeholderIcon = document.createElement('i');
                    placeholderIcon.className = 'fa-solid fa-user';
                    placeholderIcon.style.fontSize = '1.5em';
                    avatar.appendChild(placeholderIcon);

                    const avatarImg = document.createElement('img');
                    avatarImg.alt = 'User';
                    avatarImg.style.width = '100%';
                    avatarImg.style.height = '100%';
                    avatarImg.style.objectFit = 'cover';
                    avatarImg.style.borderRadius = '50%';
                    avatarImg.style.position = 'absolute';
                    avatarImg.style.top = '0';
                    avatarImg.style.left = '0';
                    avatarImg.style.opacity = '0';
                    avatarImg.style.transition = 'opacity 0.2s ease';

                    avatarImg.onload = () => {
                        avatarImg.style.opacity = '1';
                        if (placeholderIcon.parentNode === avatar) {
                            placeholderIcon.remove();
                        }
                    };

                    avatarImg.onerror = () => {
                        avatarImg.remove();
                    };

                    avatar.appendChild(avatarImg);
                    avatarImg.src = userAvatar;
                } else {
                    // 아바타가 없으면 아이콘만 표시
                    const userIcon = document.createElement('i');
                    userIcon.className = 'fa-solid fa-user';
                    userIcon.style.fontSize = '1.5em';
                    avatar.appendChild(userIcon);
                }
            } else {
                // 캐릭터 메시지: 캐릭터 아바타 업데이트
                if (characterAvatar) {
                    const placeholderIcon = document.createElement('i');
                    placeholderIcon.className = 'fa-solid fa-user';
                    placeholderIcon.style.fontSize = '1.5em';
                    avatar.appendChild(placeholderIcon);

                    const avatarImg = document.createElement('img');
                    const characterName = character?.data?.name || character?.name || 'Character';
                    avatarImg.alt = characterName;
                    avatarImg.style.width = '100%';
                    avatarImg.style.height = '100%';
                    avatarImg.style.objectFit = 'cover';
                    avatarImg.style.borderRadius = '50%';
                    avatarImg.style.position = 'absolute';
                    avatarImg.style.top = '0';
                    avatarImg.style.left = '0';
                    avatarImg.style.opacity = '0';
                    avatarImg.style.transition = 'opacity 0.2s ease';

                    avatarImg.onload = () => {
                        avatarImg.style.opacity = '1';
                        if (placeholderIcon.parentNode === avatar) {
                            placeholderIcon.remove();
                        }
                    };

                    avatarImg.onerror = () => {
                        avatarImg.remove();
                    };

                    avatar.appendChild(avatarImg);
                    avatarImg.src = characterAvatar;
                } else {
                    // 아바타가 없으면 아이콘만 표시
                    const userIcon = document.createElement('i');
                    userIcon.className = 'fa-solid fa-user';
                    userIcon.style.fontSize = '1.5em';
                    avatar.appendChild(userIcon);
                }
            }
        });

    }

    /**
     * 채팅 저장 (디바운스)
     */
    async saveChatDebounced() {
        console.debug('[saveChatDebounced] 호출됨:', {
            _isSavingChat: this._isSavingChat,
            _isLoadingMoreMessages: this._isLoadingMoreMessages,
            _isLoadingChat: this._isLoadingChat
        });
        
        // 현재 저장 중이면 무시 (중복 저장 방지)
        if (this._isSavingChat) {
            console.debug('[saveChatDebounced] 이미 저장 중이므로 건너뜀');
            return;
        }
        
        // 더보기 로딩 중이면 저장하지 않음 (중복 방지)
        if (this._isLoadingMoreMessages) {
            console.debug('[saveChatDebounced] 더보기 로딩 중이므로 건너뜀');
            return;
        }
        
        // 백그라운드 탭 감지
        let isBackground = false;
        try {
            isBackground = document.hidden || !document.hasFocus();
        } catch (e) {
            // document.hasFocus가 지원되지 않는 경우
        }
        
        // 백그라운드 탭에서는 즉시 저장 (setTimeout이 throttling되므로)
        if (isBackground) {
            if (this.saveChatDebounceTimer) {
                clearTimeout(this.saveChatDebounceTimer);
                this.saveChatDebounceTimer = null;
            }
            
            // 백그라운드에서도 실행되도록 비동기로 실행 (await 없이)
            // saveChat은 async 함수이므로 Promise로 실행되며, 백그라운드에서도 실행됨
            // 백그라운드 실행 확인을 위한 로그 (백그라운드에서도 실행되면 콘솔에 표시됨)
            console.debug('[saveChatDebounced] 백그라운드 저장 시작', { timestamp: Date.now(), isBackground: true });
            this.saveChat().then(() => {
                console.debug('[saveChatDebounced] 백그라운드 저장 완료', { timestamp: Date.now() });
            }).catch((error) => {
                console.debug('[saveChatDebounced] 백그라운드 저장 중 오류:', error);
            });
            return;
        }
        
        // 포커스된 탭에서는 디바운스 사용
        if (this.saveChatDebounceTimer) {
            clearTimeout(this.saveChatDebounceTimer);
        }
        
        // 2초 후 저장 (실리태번의 DEFAULT_SAVE_EDIT_TIMEOUT 참고)
        this.saveChatDebounceTimer = setTimeout(async () => {
            // 더보기 로딩 중이면 저장하지 않음 (타이머 실행 시점에도 확인)
            if (this._isLoadingMoreMessages) {
                return;
            }
            
            // 채팅 로딩 중이면 저장하지 않음 (타이머 실행 시점에도 확인)
            if (this._isLoadingChat) {
                return;
            }
            // DOM 업데이트 완료 대기 (메시지 카운팅 정확성 확보)
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await this.saveChat();
        }, 2000);
    }

    /**
     * 채팅 저장
     * 실리태번의 saveChat 함수와 동일한 구조
     * 
     * ⚠️ 중요: 이 함수는 다음 기능들과 강하게 연동되어 있습니다.
     * 
     * [연동 기능]
     * 1. DOM 메시지와 저장소 메시지 병합: DOM에 표시되지 않은 메시지도 보존
     *    * 불러온 채팅: DOM 5개 + 저장소 79개 = 총 79개 보존
     * 2. currentChatId 없을 때 새 채팅 생성 방지: DOM 메시지 1개 이하면 저장 건너뜀
     *    * 홈화면 나갔다가 다시 들어올 때 loadOrCreateChat이 호출되기 전에 saveChat이 호출되는 것을 방지
     * 3. character.chat 업데이트: 저장된 채팅 이름을 character.chat에 저장 (loadOrCreateChat 연동)
     * 
     * [수정 시 주의사항]
     * - 메시지 병합 로직 변경 시 → DOM 메시지와 저장소 메시지 모두 보존 확인
     * - 새 채팅 생성 조건 변경 시 → loadOrCreateChat과 일치해야 함
     * - character.chat 업데이트 위치 변경 시 → loadOrCreateChat에서 찾을 수 있도록 확인
     * 
     * @param {string} [chatName] - 저장할 채팅 이름 (선택)
     * @param {object} [withMetadata] - 추가 메타데이터 (선택)
     */
    async saveChat(chatName = null, withMetadata = {}) {
        console.debug('[ChatManager.saveChat] 저장 시작:', {
            currentChatId: this.currentChatId,
            currentCharacterId: this.currentCharacterId,
            _isSavingChat: this._isSavingChat,
            _isLoadingMoreMessages: this._isLoadingMoreMessages,
            _isLoadingChat: this._isLoadingChat
        });
        
        // 중복 저장 방지
        if (this._isSavingChat) {
            console.debug('[ChatManager.saveChat] 이미 저장 중이므로 건너뜀');
            return;
        }
        
        // 더보기 로딩 중이면 저장하지 않음 (중복 방지)
        if (this._isLoadingMoreMessages) {
            console.debug('[ChatManager.saveChat] 더보기 로딩 중이므로 건너뜀');
            return;
        }
        
        // 채팅 로딩 중이면 저장하지 않음 (중복 방지)
        if (this._isLoadingChat) {
            console.debug('[ChatManager.saveChat] 채팅 로딩 중이므로 건너뜀');
            return;
        }
        
        // 불러오기한 채팅도 저장 후에는 일반 채팅처럼 취급되므로, 저장 로직에서 특별 처리 불필요
        // 단, 그리팅만 있는 새 채팅 방지를 위해 최소한의 체크만 수행
        
        // messages 변수를 try 블록 밖에서 선언 (finally 블록에서 참조 가능하도록)
        let messages = [];
        let messageCount = 0;
        let existingChatData = null; // 메타데이터 생성에 사용
        let domMessages = null; // DOM에서 수집한 메시지 (fallback용)
        
        try {
            if (this.currentChatId) {
                try {
                    // ChatStorage - 전역 스코프에서 사용
                    existingChatData = await ChatStorage.load(this.currentChatId);
                    if (existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                        // DOM 메시지 수 확인
                        const domMessageCount = this.elements.chatMessages.querySelectorAll('.message-wrapper').length;
                        const storedMessageCount = existingChatData.messages.length;
                        const chatArrayLength = (this.chat && this.chat.length > 0) ? this.chat.length : 0;
                        
                        // 중요: this.chat의 메시지 수가 저장소보다 많으면 새 메시지가 추가된 것으로 판단
                        // (리롤 후 새 메시지 생성 완료 시 저장해야 함)
                        // 또는 DOM 메시지가 저장소 메시지보다 많으면 새 메시지가 추가된 것으로 판단
                        // (리롤 후 새 메시지가 DOM에 추가되었지만 아직 this.chat에 반영되지 않았을 수 있음)
                        const hasNewMessages = chatArrayLength > storedMessageCount || domMessageCount > storedMessageCount;
                        
                        // 불러온 채팅 로딩 중 방지: 저장소 메시지가 DOM 메시지보다 훨씬 많고, DOM 메시지가 1개 이하일 때만 저장 건너뜀
                        // 이는 불러온 채팅이 로드 중일 때 저장이 발생하는 것을 방지하기 위함
                        // 조건: 저장소 메시지가 10개 이상이고, DOM 메시지가 1개 이하이고, 새 메시지가 없을 때만 저장 건너뜀
                        // (저장소에 메시지가 많은데 DOM에는 적으면 로딩 중일 가능성이 높음)
                        // 단, 저장소 메시지가 적은 경우(새 채팅 등)는 저장해야 함
                        const isLoadingLargeChat = storedMessageCount >= 10 && domMessageCount <= 1 && !hasNewMessages;
                        
                        console.debug('[ChatManager.saveChat] 저장 전 체크:', {
                            chatId: this.currentChatId,
                            storedMessageCount,
                            domMessageCount,
                            chatArrayLength,
                            hasNewMessages,
                            isLoadingLargeChat,
                            willSave: isLoadingLargeChat ? '건너뜀 (대용량 채팅 로딩 중 방지)' : '저장 (일반 채팅 또는 불러온 채팅 모두 저장)'
                        });
                        
                        // 대용량 채팅 로딩 중인 경우에만 저장 건너뜀
                        if (isLoadingLargeChat) {
                            console.debug('[ChatManager.saveChat] 대용량 채팅 로딩 중으로 감지, 저장 건너뜀');
                            return;
                        }
                        // 그 외에는 모두 저장 (새 채팅, 불러온 채팅, 리롤 후 등 모두 저장)
                    }
                } catch (error) {
                    // 오류가 발생해도 계속 진행 (정상 채팅 저장은 계속해야 함)
                    console.debug('[ChatManager.saveChat] 저장 전 체크 중 오류 (무시):', error);
                }
            }
            
            if (!this.currentCharacterId) {
                console.debug('[ChatManager.saveChat] currentCharacterId가 없어서 저장 건너뜀');
                this._isSavingChat = false; // 저장 플래그 해제
                return;
            }
            
            console.debug('[ChatManager.saveChat] 저장 진행 중...');
            
            // 저장 시작 플래그 설정 (이미 위에서 설정했지만 다시 설정)
            this._isSavingChat = true;
            
            // CharacterStorage, ChatStorage - 전역 스코프에서 사용
            // humanizedDateTime - 전역 스코프에서 사용
            const character = await CharacterStorage.load(this.currentCharacterId);
            
            if (!character) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20012', '캐릭터를 찾을 수 없어 저장 건너뜀');
                }
                this._isSavingChat = false; // 저장 플래그 해제
                return;
            }

            const characterName = character?.data?.name || character?.name || 'Character';
            const finalChatName = chatName || this.currentChatName || `${characterName} - ${humanizedDateTime()}`;
            
            // 중요: chatId는 기존 채팅 ID를 우선 사용 (덮어쓰기 방지)
            // currentChatId가 있으면 기존 채팅 업데이트, 없으면 새 채팅 생성
            let chatId;
            let isNewChat = false;
            
            if (this.currentChatId) {
                // 기존 채팅이 있으면 그것을 사용 (덮어쓰기 방지)
                // currentChatId가 characterId와 같으면 잘못된 값이므로 null로 처리
                if (this.currentChatId === this.currentCharacterId || !this.currentChatId.includes('_')) {
                    console.warn('[ChatManager.saveChat] currentChatId가 characterId와 같거나 형식 오류, null로 처리:', {
                        currentChatId: this.currentChatId,
                        currentCharacterId: this.currentCharacterId
                    });
                    this.currentChatId = null;
                    // null로 처리했으므로 아래 else 블록으로 이동
                } else {
                    chatId = this.currentChatId;
                    // 기존 채팅 데이터 로드 (메타데이터 보존용)
                    existingChatData = await ChatStorage.load(chatId);
                    
                    // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
                    // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, UUID 매칭에서도 구분하지 않습니다.
                    // 기존 코드 (주석 처리):
                    // if (existingChatData && existingChatData.metadata?.isImported) {
                    //     console.debug('[ChatManager.saveChat] 불러온 채팅 감지, UUID 매칭 건너뛰고 기존 채팅에 저장:', {
                    //         chatId: chatId.substring(0, 50),
                    //         messageCount: existingChatData.messages?.length || 0
                    //     });
                    // }
                }
            }
            
            // currentChatId가 null이거나 characterId와 같으면 새로 찾기
            // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
            // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, UUID 매칭에서도 구분하지 않습니다.
            // 기존 코드 (주석 처리):
            // if (this._isImportedChat) {
            //     console.debug('[ChatManager.saveChat] 불러온 채팅 감지, UUID 매칭 건너뛰기:', {
            //         isImportedChat: this._isImportedChat,
            //         chatArrayLength: this.chat?.length || 0
            //     });
            //     if (!this.currentChatId) {
            //         console.warn('[ChatManager.saveChat] 불러온 채팅인데 currentChatId가 없음, 저장 건너뜀');
            //         this._isSavingChat = false;
            //         return;
            //     }
            //     chatId = this.currentChatId;
            //     existingChatData = await ChatStorage.load(chatId);
            // } else {
            if (!chatId) {
                    // ⚠️ 중요: 새 채팅 생성 직후 판단
                    // createNewChat() 직후에는:
                    // 1. this.chat이 비어있거나 새로 생성된 그리팅 1개만 있어야 함
                    // 2. 새로 생성된 메시지의 UUID는 기존 채팅에 없으므로 매칭되지 않음
                    // 3. 하지만 만약 이전 채팅의 메시지가 DOM에 남아있다면 잘못 매칭될 수 있음
                    // 따라서 새 채팅 생성 직후이고, this.chat이 0개 또는 1개(그리팅만)이고,
                    // chatCreateDate가 최근(5초 이내)이면 새 채팅으로 판단하여 UUID 매칭 건너뛰기
                    const isRecentlyCreatedChat = this._isNewChatCreated && 
                        this.chatCreateDate && 
                        (Date.now() - this.chatCreateDate) < 5000 && // 5초 이내
                        this.chat.length <= 1; // 그리팅만 있거나 비어있음
                    
                    if (isRecentlyCreatedChat) {
                        console.debug('[ChatManager.saveChat] 새 채팅 생성 직후로 판단, UUID 매칭 건너뛰기:', {
                            isNewChatCreated: this._isNewChatCreated,
                            chatCreateDate: this.chatCreateDate,
                            timeSinceCreation: Date.now() - this.chatCreateDate,
                            chatLength: this.chat.length
                        });
                    } else {
                    // currentChatId가 null이지만 기존 채팅이 있을 수 있음 (regenerateMessage 후 등)
                    // 1. 먼저 this.chat의 UUID로 매칭 시도 (리롤 후 새 메시지 생성 완료 시 필요)
                    if (this.chat && this.chat.length > 0 && this.currentCharacterId) {
                    try {
                        const allChats = await ChatStorage.loadAll();
                        const chatMessageUuids = this.chat.map(msg => msg.uuid).filter(uuid => uuid);
                        
                        if (chatMessageUuids.length > 0) {
                            // 모든 채팅에서 this.chat의 UUID를 포함하는 채팅 찾기
                            // 매칭되는 UUID가 가장 많은 채팅을 선택 (가장 정확한 채팅)
                            let bestMatch = null;
                            let bestMatchCount = 0;
                            
                            for (const [candidateChatId, candidateChatData] of Object.entries(allChats)) {
                                if (candidateChatData && candidateChatData.characterId === this.currentCharacterId) {
                                    // chatId가 characterId와 같으면 잘못된 매칭 (characterId는 채팅 ID가 아님)
                                    if (candidateChatId === this.currentCharacterId || !candidateChatId.includes('_')) {
                                        continue;
                                    }
                                    
                                    // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 UUID 매칭에서 제외하지 않음
                                    // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, UUID 매칭에서도 구분하지 않습니다.
                                    // 기존 코드 (주석 처리):
                                    // if (candidateChatData.metadata?.isImported) {
                                    //     continue;
                                    // }
                                    
                                    const candidateMessages = candidateChatData.messages || [];
                                    const candidateUuids = candidateMessages.map(msg => msg.uuid).filter(uuid => uuid);
                                    // this.chat의 UUID 중 매칭되는 개수 계산
                                    const matchedUuids = chatMessageUuids.filter(uuid => candidateUuids.includes(uuid));
                                    const matchCount = matchedUuids.length;
                                    
                                    // 매칭되는 UUID가 가장 많은 채팅 선택
                                    if (matchCount > bestMatchCount) {
                                        bestMatchCount = matchCount;
                                        bestMatch = {
                                            chatId: candidateChatId,
                                            chatData: candidateChatData,
                                            matchedCount: matchCount
                                        };
                                    }
                                }
                            }
                            
                            // 매칭되는 UUID가 this.chat의 절반 이상이면 해당 채팅으로 판단
                            if (bestMatch && bestMatchCount >= Math.ceil(chatMessageUuids.length / 2)) {
                                existingChatData = bestMatch.chatData;
                                chatId = bestMatch.chatId;
                                this.currentChatId = bestMatch.chatId; // 복원
                                console.debug('[ChatManager.saveChat] currentChatId 복원 (this.chat UUID 매칭 - 시작 부분):', {
                                    chatId: chatId.substring(0, 50),
                                    messageCount: existingChatData.messages?.length || 0,
                                    chatUuidsCount: chatMessageUuids.length,
                                    matchedUuids: bestMatchCount,
                                    matchRatio: (bestMatchCount / chatMessageUuids.length * 100).toFixed(1) + '%'
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('[ChatManager.saveChat] 기존 채팅 찾기 실패 (this.chat 경로 - 시작 부분):', error);
                    }
                }
                    }
                }
                
                // 2. this.chat 매칭 실패 시 DOM 메시지 UUID로 매칭 시도 (fallback)
                // ⚠️ 중요: 새 채팅 생성 직후에는 UUID 매칭 건너뛰기
                const isRecentlyCreatedChatForDOM = this._isNewChatCreated && 
                    this.chatCreateDate && 
                    (Date.now() - this.chatCreateDate) < 5000 && // 5초 이내
                    this.chat.length <= 1; // 그리팅만 있거나 비어있음
                
                if (!chatId && !isRecentlyCreatedChatForDOM) {
                    const messageWrappersForCheck = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'));
                    if (messageWrappersForCheck.length > 0 && this.currentCharacterId) {
                        try {
                            const allChats = await ChatStorage.loadAll();
                            const domMessageUuidsForCheck = messageWrappersForCheck
                                .map(w => w.dataset.messageUuid)
                                .filter(uuid => uuid);
                            
                            if (domMessageUuidsForCheck.length > 0) {
                                // 모든 채팅에서 DOM 메시지 UUID를 포함하는 채팅 찾기
                                // 매칭되는 UUID가 가장 많은 채팅을 선택 (가장 정확한 채팅)
                                let bestMatch = null;
                                let bestMatchCount = 0;
                                
                                for (const [candidateChatId, candidateChatData] of Object.entries(allChats)) {
                                    if (candidateChatData && candidateChatData.characterId === this.currentCharacterId) {
                                        // chatId가 characterId와 같으면 잘못된 매칭 (characterId는 채팅 ID가 아님)
                                        if (candidateChatId === this.currentCharacterId || !candidateChatId.includes('_')) {
                                            continue;
                                        }
                                        
                                        // ⚠️ 중요: 불러온 채팅(isImported)은 UUID 매칭에서 제외
                                        // 불러온 채팅의 UUID가 새 채팅 생성 시 잘못 매칭되는 것을 방지
                                        if (candidateChatData.metadata?.isImported) {
                                            continue;
                                        }
                                        
                                        const candidateMessages = candidateChatData.messages || [];
                                        const candidateUuids = candidateMessages.map(msg => msg.uuid).filter(uuid => uuid);
                                        // DOM 메시지 UUID 중 매칭되는 개수 계산
                                        const matchedUuids = domMessageUuidsForCheck.filter(uuid => candidateUuids.includes(uuid));
                                        const matchCount = matchedUuids.length;
                                        
                                        // 매칭되는 UUID가 가장 많은 채팅 선택
                                        if (matchCount > bestMatchCount) {
                                            bestMatchCount = matchCount;
                                            bestMatch = {
                                                chatId: candidateChatId,
                                                chatData: candidateChatData,
                                                matchedCount: matchCount
                                            };
                                        }
                                    }
                                }
                                
                                // 매칭되는 UUID가 DOM 메시지의 절반 이상이면 해당 채팅으로 판단
                                if (bestMatch && bestMatchCount >= Math.ceil(domMessageUuidsForCheck.length / 2)) {
                                    existingChatData = bestMatch.chatData;
                                    chatId = bestMatch.chatId;
                                    this.currentChatId = bestMatch.chatId; // 복원
                                    console.log('[ChatManager.saveChat] currentChatId 복원 (DOM UUID 매칭):', {
                                        chatId: chatId.substring(0, 50),
                                        messageCount: existingChatData.messages?.length || 0,
                                        domUuidsCount: domMessageUuidsForCheck.length,
                                        matchedUuids: bestMatchCount
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn('[ChatManager.saveChat] 기존 채팅 찾기 실패 (DOM 경로):', error);
                        }
                    }
                }
                
                // 복원 실패 시에만 새 채팅 생성 로직 진행
                if (!chatId) {
                // DOM 메시지 수를 먼저 확인 (메시지 수집 전이므로 DOM에서 직접 확인)
                const messageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'));
                const domMessageCount = messageWrappers.length;
                
                // 중요: currentChatId가 없고 DOM 메시지가 0개면 저장하지 않음
                // 홈화면으로 나갔다가 다시 캐릭터를 선택할 때 loadOrCreateChat이 호출되기 전에
                // saveChat이 호출되면 새 채팅이 생성되는 것을 방지
                // 그리팅만 있어도 저장해야 함 (채팅 목록에 표시되어야 하므로)
                if (domMessageCount === 0) {
                    console.debug('[ChatManager.saveChat] currentChatId 없고 DOM 메시지 0개, 저장 건너뜀 (loadOrCreateChat에서 처리):', {
                        domMessageCount,
                        currentChatId: this.currentChatId
                    });
                    this._isSavingChat = false; // 저장 플래그 해제
                    return;
                }
                
                // 새 채팅 생성 (고유 ID 보장)
                // 같은 이름의 채팅이 이미 존재하는지 확인하여 중복 방지
                // 새 채팅은 항상 타임스탬프를 포함하여 고유 ID 생성 (불러온 채팅과 구분)
                const timestamp = Date.now();
                let candidateChatId = `${this.currentCharacterId}_${finalChatName}_${timestamp}`;
                
                // 여전히 중복되는지 확인 (드물지만 가능)
                let retryCount = 0;
                while (await ChatStorage.load(candidateChatId) && retryCount < 5) {
                    candidateChatId = `${this.currentCharacterId}_${finalChatName}_${Date.now()}`;
                    retryCount++;
                }
                
                chatId = candidateChatId;
                isNewChat = true;
                
                console.debug('[ChatManager.saveChat] 새 채팅 ID 생성:', {
                    chatId,
                    chatName: finalChatName,
                    timestamp
                });
            }

            // 실리태번과 동일: chat 배열을 그대로 저장
            // 실리태번의 saveChat(): const trimmedChat = (mesId !== undefined && mesId >= 0 && mesId < chat.length)
            //     ? chat.slice(0, Number(mesId) + 1)
            //     : chat.slice();
            //     const chatToSave = [{ 헤더 }, ...trimmedChat];
            //
            // ⚠️ 중요: 실리태번은 chat 배열을 단일 소스로 사용합니다.
            // DOM은 단순히 표시용이며, 저장 시에는 chat 배열을 그대로 사용합니다.
            // 우리도 동일하게 this.chat 배열을 단일 소스로 사용합니다.
            
            // messages 배열 초기화
            messages = [];
            
            // 실리태번과 동일: this.chat 배열을 그대로 사용 (DOM이 아닌 chat 배열을 소스로)
            // 이렇게 하면 messagesToLoad 설정과 무관하게 모든 메시지가 저장됩니다.
            // 실리태번: const trimmedChat = chat.slice(); messages = [...trimmedChat];
            // 단, 기존 채팅이 있고 저장소에 메시지가 있으면 병합 로직을 거쳐야 함 (삭제된 메시지 제외)
            // currentChatId가 null이면 UUID 매칭으로 기존 채팅 찾기 시도
            if (this.chat && this.chat.length > 0) {
                // currentChatId가 null이면 UUID 매칭으로 기존 채팅 찾기 시도 (리롤 후 새 메시지 생성 시 필요)
                if (!this.currentChatId && this.currentCharacterId) {
                    try {
                        const allChats = await ChatStorage.loadAll();
                        const chatMessageUuids = this.chat.map(msg => msg.uuid).filter(uuid => uuid);
                        
                        if (chatMessageUuids.length > 0) {
                            // 모든 채팅에서 this.chat의 UUID를 포함하는 채팅 찾기
                            // 매칭되는 UUID가 가장 많은 채팅을 선택 (가장 정확한 채팅)
                            let bestMatch = null;
                            let bestMatchCount = 0;
                            
                            for (const [candidateChatId, candidateChatData] of Object.entries(allChats)) {
                                if (candidateChatData && candidateChatData.characterId === this.currentCharacterId) {
                                    // ⚠️ 중요: 불러온 채팅(isImported)은 UUID 매칭에서 제외
                                    // 불러온 채팅의 UUID가 새 채팅 생성 시 잘못 매칭되는 것을 방지
                                    if (candidateChatData.metadata?.isImported) {
                                        continue;
                                    }
                                    
                                    const candidateMessages = candidateChatData.messages || [];
                                    const candidateUuids = candidateMessages.map(msg => msg.uuid).filter(uuid => uuid);
                                    // this.chat의 UUID 중 매칭되는 개수 계산
                                    const matchedUuids = chatMessageUuids.filter(uuid => candidateUuids.includes(uuid));
                                    const matchCount = matchedUuids.length;
                                    
                                    // 매칭되는 UUID가 가장 많은 채팅 선택
                                    if (matchCount > bestMatchCount) {
                                        bestMatchCount = matchCount;
                                        bestMatch = {
                                            chatId: candidateChatId,
                                            chatData: candidateChatData,
                                            matchedCount: matchCount
                                        };
                                    }
                                }
                            }
                            
                            // 매칭되는 UUID가 this.chat의 절반 이상이면 해당 채팅으로 판단
                            // chatId가 characterId와 같거나 형식이 잘못된 경우 제외
                            if (bestMatch && bestMatchCount >= Math.ceil(chatMessageUuids.length / 2)) {
                                const candidateChatId = bestMatch.chatId;
                                // chatId가 characterId와 같으면 잘못된 매칭 (characterId는 채팅 ID가 아님)
                                // chatId는 보통 "characterId_chatName_timestamp" 형식
                                if (candidateChatId && candidateChatId !== this.currentCharacterId && candidateChatId.includes('_')) {
                                    existingChatData = bestMatch.chatData;
                                    chatId = candidateChatId;
                                    this.currentChatId = candidateChatId; // 복원
                                    console.log('[ChatManager.saveChat] currentChatId 복원 (this.chat UUID 매칭):', {
                                        chatId: chatId.substring(0, 50),
                                        messageCount: existingChatData.messages?.length || 0,
                                        chatUuidsCount: chatMessageUuids.length,
                                        matchedUuids: bestMatchCount,
                                        matchRatio: (bestMatchCount / chatMessageUuids.length * 100).toFixed(1) + '%'
                                    });
                                } else {
                                    console.warn('[ChatManager.saveChat] 잘못된 chatId 매칭 건너뜀:', {
                                        candidateChatId: candidateChatId?.substring(0, 50),
                                        currentCharacterId: this.currentCharacterId,
                                        reason: candidateChatId === this.currentCharacterId ? 'characterId와 동일' : 'chatId 형식 오류'
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('[ChatManager.saveChat] 기존 채팅 찾기 실패 (this.chat 경로):', error);
                    }
                }
                
                // 기존 채팅이 있고 저장소에 메시지가 있으면 병합 로직 필요 (삭제된 메시지 제외)
                // 중요: 리롤 직후 저장 시 existingChatData.messages.length === 0일 수 있음 (삭제된 메시지만 저장됨)
                // 이 경우 this.chat을 사용해야 함
                if (this.currentChatId && existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                    // 병합 로직을 거치기 위해 DOM 수집 경로로 이동
                    // (실제로는 this.chat을 사용하지만, existingMessages와 병합하여 삭제된 메시지 제외)
                    console.log('[ChatManager.saveChat] 기존 채팅이 있으므로 병합 로직 사용:', {
                        chatArrayLength: this.chat.length,
                        existingMessageCount: existingChatData.messages.length,
                        currentChatId: this.currentChatId.substring(0, 30)
                    });
                    // DOM 수집 경로로 이동하여 병합 로직 사용
                    // (실제로는 this.chat을 domMessages로 사용)
                    // messages는 아직 설정하지 않음 (아래 병합 로직에서 처리)
                } else {
                    // 새 채팅이거나 저장소에 메시지가 없으면 this.chat을 직접 사용
                    // 중요: 리롤 직후 저장 시 this.chat이 비어있을 수 있음 (이 경우 0개 메시지로 저장됨 - 정상)
                    // 하지만 existingChatData가 있으면 병합 로직을 거쳐야 함 (삭제된 메시지 제외)
                    if (existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                        // 병합 로직 경로로 이동 (아래에서 처리)
                        console.debug('[ChatManager.saveChat] 기존 채팅이 있으므로 병합 로직 사용 (this.chat 경로):', {
                            chatArrayLength: this.chat.length,
                            existingMessageCount: existingChatData.messages.length,
                            currentChatId: this.currentChatId?.substring(0, 30) || 'null'
                        });
                    } else {
                        messages = [...this.chat];
                        console.debug('[ChatManager.saveChat] ✅ this.chat 배열을 소스로 사용 (실리태번 방식):', {
                            chatArrayLength: this.chat.length,
                            messagesCount: messages.length,
                            currentChatId: this.currentChatId?.substring(0, 30) || 'null',
                            existingChatData: existingChatData ? { hasMessages: !!existingChatData.messages, messageCount: existingChatData.messages?.length || 0 } : null
                        });
                    }
                }
            }
            
            // this.chat이 비어있거나 병합이 필요한 경우 DOM에서 수집
            // 중요: 기존 채팅이 있는 경우 병합 로직에서 처리되므로 여기서는 건너뜀
            // 단, 리롤 직후 저장 시 this.chat에 메시지가 있으면 DOM 수집을 건너뛰고 병합 로직으로 이동
            const shouldSkipDOMCollection = (this.currentChatId && existingChatData && existingChatData.messages && existingChatData.messages.length > 0) ||
                                            (this.chat && this.chat.length > 0);
            if ((!messages || messages.length === 0) && !shouldSkipDOMCollection) {
                // this.chat이 비어있으면 DOM에서 수집 (fallback - 비정상적인 경우)
                console.warn('[ChatManager.saveChat] ⚠️ this.chat이 비어있어 DOM에서 수집 (fallback)');
                
                // 백그라운드 탭 감지
                let isBackground = false;
                try {
                    isBackground = document.hidden || !document.hasFocus();
                } catch (e) {
                    // document.hasFocus가 지원되지 않는 경우
                }
                
                // DOM 업데이트 완료 대기 (메시지 삭제 후 즉시 저장할 때 DOM이 완전히 업데이트되도록)
                // 백그라운드 탭에서는 waitForDOMUpdate 사용 (마이크로태스크 큐 기반으로 즉시 실행)
                if (typeof waitForDOMUpdate === 'function') {
                    // 백그라운드에서도 작동하도록 waitForDOMUpdate 사용
                    await waitForDOMUpdate();
                    // 한 번 더 호출하여 완전히 실행되도록 보장
                    await waitForDOMUpdate();
                } else {
                    // 폴백: 포커스된 탭에서만 requestAnimationFrame 사용
                    if (!isBackground) {
                        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
                    }
                }
                    
                // DOM에서 메시지 수집 (재시도 로직 추가)
                // loadChat 후 즉시 saveChat이 호출될 때 DOM 업데이트가 완료되지 않았을 수 있음
                let messageWrappers = [];
                let retryCount = 0;
                const maxRetries = 5;
                
                while (retryCount < maxRetries) {
                    // 모든 메시지 래퍼 수집 (숨겨진 메시지 제외)
                    messageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                        .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
                    
                    // 메시지가 있으면 반복 종료
                    if (messageWrappers.length > 0) {
                        break;
                    }
                    
                    // 메시지가 없고 로딩 중이면 대기 후 재시도
                    if (this._isLoadingChat || this._isLoadingMoreMessages) {
                        // 백그라운드 탭에서도 작동하도록 waitForDOMUpdate 사용
                        if (typeof waitForDOMUpdate === 'function') {
                            await waitForDOMUpdate();
                        } else {
                            // 폴백: 포커스된 탭에서만 requestAnimationFrame 사용
                            if (!isBackground) {
                                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                            } else {
                                // 백그라운드에서는 마이크로태스크 큐 사용
                                await Promise.resolve();
                            }
                        }
                        retryCount++;
                    } else {
                        // 로딩 중이 아니면 메시지가 실제로 없는 것
                        break;
                    }
                }
                
                // this.chat이 있고 병합이 필요한 경우, this.chat을 domMessages로 사용
                if (this.chat && this.chat.length > 0 && this.currentChatId && existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                    // this.chat을 domMessages로 변환 (DOM에서 최신 내용 확인)
                    domMessages = this.chat.map(msg => {
                        // DOM에서 최신 내용 확인 (편집된 경우)
                        const wrapper = messageWrappers.find(w => w.dataset.messageUuid === msg.uuid);
                        if (wrapper) {
                            const messageDiv = wrapper.querySelector('.message');
                            if (!messageDiv) return msg;

                            const messageText = wrapper.querySelector('.message-text');
                            if (!messageText) return msg;

                            const originalText = wrapper.dataset.originalText || messageText.textContent.trim();
                            
                            // 실리태번과 동일: this.chat 배열의 메시지 내용을 우선 사용 (편집된 경우 정규식 적용된 텍스트)
                            // DOM의 originalText는 편집 전 원본이므로, this.chat에 저장된 값이 최신임
                            let finalMessageText = originalText;
                            const chatMessage = this.chat.find(m => m.uuid === msg.uuid);
                            if (chatMessage && chatMessage.mes) {
                                finalMessageText = chatMessage.mes; // this.chat의 메시지가 최신 (편집된 경우 정규식 적용됨)
                            }
                            
                            // DOM에서 추가 정보 수집
                            const sendDate = wrapper.dataset.sendDate ? parseInt(wrapper.dataset.sendDate) : (msg.send_date || null);
                            
                            // 스와이프 데이터 가져오기
                            let swipes = [];
                            if (wrapper.dataset.swipes) {
                                try {
                                    swipes = JSON.parse(wrapper.dataset.swipes);
                                } catch (e) {
                                    // 무시
                                }
                            }
                            
                            // 추론 내용 가져오기
                            let reasoning = null;
                            if (msg.extra && msg.extra.reasoning) {
                                reasoning = msg.extra.reasoning;
                            } else if (wrapper.dataset.reasoning) {
                                reasoning = wrapper.dataset.reasoning;
                            }
                            
                            // ⚠️ 중요: 유저 메시지의 원본 이름 보존 (불러온 채팅)
                            let messageName = msg.name;
                            if (msg.is_user) {
                                // 1. dataset에서 원본 이름 확인 (불러온 채팅)
                                if (wrapper.dataset.originalUserName) {
                                    messageName = wrapper.dataset.originalUserName;
                                }
                                // 2. DOM의 .message-name 요소에서 이름 읽기
                                else {
                                    const messageNameElement = wrapper.querySelector('.message-name');
                                    if (messageNameElement && messageNameElement.textContent && messageNameElement.textContent !== 'User') {
                                        messageName = messageNameElement.textContent.trim();
                                    }
                                }
                                // 3. msg.name이 'User'가 아니면 원본으로 간주
                                if (!messageName || messageName === 'User') {
                                    if (msg.name && msg.name !== 'User') {
                                        messageName = msg.name;
                                    }
                                }
                            }
                            
                            // DOM에서 최신 내용으로 업데이트
                            return {
                                ...msg,
                                name: messageName, // 원본 이름 보존
                                mes: finalMessageText,
                                send_date: sendDate,
                                extra: {
                                    ...msg.extra,
                                    swipes: swipes.length > 1 ? swipes.slice(1) : [],
                                    ...(reasoning ? { reasoning } : {})
                                }
                            };
                        }
                        return msg;
                    });
                    console.debug('[ChatManager.saveChat] this.chat을 domMessages로 사용 (병합 로직 준비):', {
                        chatArrayLength: this.chat.length,
                        domMessagesLength: domMessages.length
                    });
                } else {
                    domMessages = [];
                }
                
                messageWrappers.forEach(wrapper => {
                    const messageDiv = wrapper.querySelector('.message');
                    if (!messageDiv) return;

                    const isUser = messageDiv.classList.contains('user');
                    const messageText = wrapper.querySelector('.message-text');
                    if (!messageText) return;

                    const originalText = wrapper.dataset.originalText || messageText.textContent.trim();
                    
                    // 실리태번과 동일: 메시지 고유 ID 및 send_date 가져오기
                    const messageUuid = wrapper.dataset.messageUuid || null;
                    const sendDate = wrapper.dataset.sendDate ? parseInt(wrapper.dataset.sendDate) : null;
                    
                    // 메시지 시간 업데이트 (날짜+시간 형식으로 표시)
                    const messageTime = wrapper.querySelector('.message-time');
                    if (messageTime) {
                        const formatDateTime = (timestamp) => {
                            const date = new Date(timestamp);
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const hour = String(date.getHours()).padStart(2, '0');
                            const minute = String(date.getMinutes()).padStart(2, '0');
                            return `${year}년 ${month}월 ${day}일 ${hour}:${minute}`;
                        };
                        messageTime.textContent = formatDateTime(sendDate);
                    }
                    
                    // 스와이프 데이터 가져오기
                    let swipes = [];
                    if (wrapper.dataset.swipes) {
                        try {
                            swipes = JSON.parse(wrapper.dataset.swipes);
                        } catch (e) {
                            // 경고 코드 토스트 알림 표시
                            if (typeof showErrorCodeToast === 'function') {
                                showErrorCodeToast('WARN_CHAT_20013', '스와이프 데이터 파싱 실패', e);
                            }
                        }
                    }
                    
                    // 실리태번과 동일: force_avatar 가져오기
                    const forceAvatar = wrapper.dataset.forceAvatar || null;
                    
                    // 실리태번과 동일: 메시지의 name 필드 확인 (다른 캐릭터가 보낸 메시지 처리)
                    let messageName = isUser ? 'User' : characterName;
                    
                    if (isUser) {
                        // ⚠️ 중요: 유저 메시지의 경우 원본 이름 우선 사용 (불러온 채팅의 원본 이름 보존)
                        // 1. dataset에서 원본 이름 확인 (불러온 채팅)
                        if (wrapper.dataset.originalUserName) {
                            messageName = wrapper.dataset.originalUserName;
                        }
                        // 2. DOM의 .message-name 요소에서 이름 읽기 (원본 이름이 저장된 경우)
                        else {
                            const messageNameElement = wrapper.querySelector('.message-name');
                            if (messageNameElement && messageNameElement.textContent && messageNameElement.textContent !== 'User') {
                                messageName = messageNameElement.textContent.trim();
                            }
                        }
                        // 3. this.chat 배열에서 원본 name 확인 (fallback)
                        if (messageName === 'User' && messageUuid && this.chat) {
                            const chatMessage = this.chat.find(msg => msg.uuid === messageUuid);
                            if (chatMessage && chatMessage.name && chatMessage.name !== 'User') {
                                messageName = chatMessage.name;
                            }
                        }
                    } else {
                        // AI 메시지: 다른 캐릭터 처리
                        if (wrapper.dataset.characterName) {
                            const storedCharacterName = wrapper.dataset.characterName;
                            if (storedCharacterName !== characterName) {
                                messageName = storedCharacterName;
                            }
                        }
                    }

                    // 추론 내용 가져오기 (여러 소스에서 확인)
                    let reasoning = null;
                    
                    // 1. 먼저 this.chat 배열에서 찾기
                    if (messageUuid && this.chat) {
                        const chatMessage = this.chat.find(msg => msg.uuid === messageUuid);
                        if (chatMessage && chatMessage.extra && chatMessage.extra.reasoning) {
                            reasoning = chatMessage.extra.reasoning;
                        }
                    }
                    
                    // 2. this.chat에서 찾지 못했으면 DOM의 dataset에서 직접 읽기
                    if (!reasoning) {
                        const storedReasoning = wrapper.dataset.reasoning || null;
                        if (storedReasoning) {
                            reasoning = storedReasoning;
                        }
                    }
                    
                    // 실리태번과 동일: this.chat 배열의 메시지 내용을 우선 사용 (편집된 경우 정규식 적용된 텍스트)
                    // DOM의 originalText는 편집 전 원본이므로, this.chat에 저장된 값이 최신임
                    let finalMessageText = originalText;
                    if (messageUuid && this.chat) {
                        const chatMessage = this.chat.find(msg => msg.uuid === messageUuid);
                        if (chatMessage && chatMessage.mes) {
                            finalMessageText = chatMessage.mes; // this.chat의 메시지가 최신 (편집된 경우 정규식 적용됨)
                            if (finalMessageText !== originalText) {
                                console.log('[ChatManager.saveChat] this.chat 메시지 사용:', {
                                    uuid: messageUuid.substring(0, 8),
                                    originalText: originalText.substring(0, 50),
                                    finalMessageText: finalMessageText.substring(0, 50)
                                });
                            }
                        }
                    }
                    
                    const message = {
                        uuid: messageUuid,
                        send_date: sendDate,
                        name: messageName,
                        is_user: isUser,
                        is_system: false,
                        mes: finalMessageText,
                        extra: {
                            swipes: swipes.length > 1 ? swipes.slice(1) : [],
                        },
                    };
                    
                    // 추론 내용 추가
                    if (reasoning) {
                        if (!message.extra) {
                            message.extra = {};
                        }
                        message.extra.reasoning = reasoning;
                    }
                    
                    // 실리태번과 동일: force_avatar 추가
                    if (isUser && forceAvatar) {
                        message.force_avatar = forceAvatar;
                    }

                    domMessages.push(message);
                });
                
                // 실리태번과 동일: send_date 기준으로 정렬 (오름차순, 오래된 것부터 최근 순서)
                domMessages.sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                
                // 디버깅: DOM에서 수집한 메시지 UUID 확인
                const collectedUuids = domMessages.map(msg => msg.uuid?.substring(0, 8) || 'no-uuid');
                console.debug('[ChatManager.saveChat] DOM에서 메시지 수집:', {
                    domMessageCount: domMessages.length,
                    collectedUuids: collectedUuids,
                    // DOM에서 실제로 찾은 메시지 래퍼 수와 비교
                    actualWrapperCount: messageWrappers.length
                });
                
                // 중요: DOM 메시지와 IndexedDB의 기존 메시지를 병합
                // 더보기로 추가된 메시지는 이미 IndexedDB에 저장되어 있으므로,
                // DOM에 없는 메시지도 보존해야 함
                
                // existingChatData가 없으면 찾기 시도 (currentChatId가 없거나 새 채팅으로 인식된 경우)
                // DOM 메시지 UUID와 this.chat UUID 모두 사용하여 기존 채팅 찾기
                if (!existingChatData && this.currentCharacterId) {
                    try {
                        const allChats = await ChatStorage.loadAll();
                        
                        // DOM 메시지의 UUID 수집
                        const domMessageUuids = domMessages.map(msg => msg.uuid).filter(uuid => uuid);
                        
                        // this.chat의 UUID도 수집 (리롤 후 새 메시지 생성 시 기존 메시지 UUID 사용)
                        const chatMessageUuids = [];
                        if (this.chat && this.chat.length > 0) {
                            this.chat.forEach(msg => {
                                if (msg.uuid) {
                                    chatMessageUuids.push(msg.uuid);
                                }
                            });
                        }
                        
                        // DOM UUID와 chat UUID를 합쳐서 사용
                        const allMessageUuids = [...new Set([...domMessageUuids, ...chatMessageUuids])];
                        
                        if (allMessageUuids.length > 0) {
                            // 모든 채팅에서 메시지 UUID를 포함하는 채팅 찾기
                            // 매칭되는 UUID가 가장 많은 채팅을 선택 (가장 정확한 채팅)
                            let bestMatch = null;
                            let bestMatchCount = 0;
                            
                            for (const [candidateChatId, candidateChatData] of Object.entries(allChats)) {
                                if (candidateChatData && candidateChatData.characterId === this.currentCharacterId) {
                                    // chatId가 characterId와 같으면 잘못된 매칭 (characterId는 채팅 ID가 아님)
                                    if (candidateChatId === this.currentCharacterId || !candidateChatId.includes('_')) {
                                        continue;
                                    }
                                    
                                    // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 UUID 매칭에서 제외하지 않음
                                    // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, UUID 매칭에서도 구분하지 않습니다.
                                    // 기존 코드 (주석 처리):
                                    // if (candidateChatData.metadata?.isImported) {
                                    //     continue;
                                    // }
                                    
                                    const candidateMessages = candidateChatData.messages || [];
                                    const candidateUuids = candidateMessages.map(msg => msg.uuid).filter(uuid => uuid);
                                    // 메시지 UUID 중 매칭되는 개수 계산
                                    const matchedUuids = allMessageUuids.filter(uuid => candidateUuids.includes(uuid));
                                    const matchCount = matchedUuids.length;
                                    
                                    // 매칭되는 UUID가 가장 많은 채팅 선택
                                    if (matchCount > bestMatchCount) {
                                        bestMatchCount = matchCount;
                                        bestMatch = {
                                            chatId: candidateChatId,
                                            chatData: candidateChatData,
                                            matchedCount: matchCount
                                        };
                                    }
                                }
                            }
                            
                            // 매칭되는 UUID가 전체 UUID의 절반 이상이면 해당 채팅으로 판단
                            if (bestMatch && bestMatchCount >= Math.ceil(allMessageUuids.length / 2)) {
                                existingChatData = bestMatch.chatData;
                                chatId = bestMatch.chatId;
                                this.currentChatId = bestMatch.chatId; // 복원
                                isNewChat = false; // 새 채팅이 아님
                                console.log('[ChatManager.saveChat] 기존 채팅 발견 (UUID 매칭):', {
                                    chatId: chatId.substring(0, 50),
                                    messageCount: existingChatData.messages?.length || 0,
                                    domUuidsCount: domMessageUuids.length,
                                    chatUuidsCount: chatMessageUuids.length,
                                    matchedUuids: bestMatchCount,
                                    matchRatio: (bestMatchCount / allMessageUuids.length * 100).toFixed(1) + '%'
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('[ChatManager.saveChat] 기존 채팅 찾기 실패:', error);
                    }
                }
            }
                
                // existingChatData가 있으면 병합 (기존 채팅이거나 찾은 채팅)
                // 중요: DOM에 표시되지 않은 메시지도 보존해야 함
                // currentChatId가 null이지만 existingChatData가 있으면 chatId 복원
                // 중요: 리롤 직후 저장 시 existingChatData.messages.length === 0일 수 있음 (삭제된 메시지만 저장됨)
                // 이 경우 this.chat을 사용해야 함
                if (existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                    // currentChatId가 null이면 chatId 복원 (regenerateMessage 후 저장 시 필요)
                    if (!this.currentChatId && chatId) {
                        this.currentChatId = chatId;
                        console.log('[ChatManager.saveChat] currentChatId 복원 (existingChatData 병합):', {
                            chatId: chatId.substring(0, 30)
                        });
                    }
                    // 중요: domMessages가 null이면 this.chat을 사용 (리롤 후 새 메시지 생성 시)
                    // this.chat에는 새 메시지가 포함되어 있음
                    if (domMessages === null && this.chat && this.chat.length > 0) {
                        domMessages = this.chat.map(msg => ({
                            ...msg,
                            // DOM에서 수집한 것처럼 변환
                            uuid: msg.uuid,
                            send_date: msg.send_date || Date.now()
                        }));
                        console.debug('[ChatManager.saveChat] this.chat을 domMessages로 사용 (리롤 후 새 메시지):', {
                            chatArrayLength: this.chat.length,
                            domMessagesLength: domMessages.length
                        });
                    }
                    
                    // 삭제된 메시지를 제외한 기존 메시지 필터링
                    const existingMessages = (existingChatData.messages || []).filter(msg => {
                        // _deletedMessageUuids에 포함된 메시지는 제외
                        if (msg.uuid && this._deletedMessageUuids && this._deletedMessageUuids.has(msg.uuid)) {
                            return false;
                        }
                        return true;
                    });
                    
                    // ⚠️ 중요: 불러온 채팅도 불러온 직후부터는 일반 채팅처럼 관리
                    // (this.chat이 단일 소스이므로 특별 취급 불필요)
                    let messagesAlreadySet = false;
                    // domMessages가 null이면 빈 배열로 처리 (this.chat 사용 시 이미 위에서 설정됨)
                    const domMessagesForUuids = domMessages || [];
                    const domMessageUuids = new Set(domMessagesForUuids.map(msg => msg.uuid).filter(uuid => uuid));
                    
                    // DOM에 없는 메시지는 IndexedDB에서 가져와서 병합
                    const missingMessages = existingMessages.filter(msg => {
                        if (!msg.uuid) return false; // UUID가 없으면 제외 (레거시 메시지)
                        return !domMessageUuids.has(msg.uuid);
                    });
                    
                    console.debug('[ChatManager.saveChat] 메시지 병합:', {
                        chatId: chatId?.substring(0, 30),
                        domMessageCount: (domMessages || []).length,
                        existingMessageCount: existingMessages.length,
                        missingMessageCount: missingMessages.length,
                        willMerge: missingMessages.length > 0 || existingMessages.length > (domMessages || []).length,
                        currentChatId: this.currentChatId?.substring(0, 30),
                        isNewChat: isNewChat,
                        messagesAlreadySet: messagesAlreadySet
                    });
                    
                    // ⚠️ 중요: messages가 이미 설정되었으면 병합 로직 건너뜀 (불러온 채팅이고 아무 메시지도 추가하지 않음)
                    if (messagesAlreadySet) {
                        console.debug('[ChatManager.saveChat] messages가 이미 설정되어 병합 로직 건너뜀:', {
                            messageCount: messages.length,
                            reason: '불러온 채팅이고 아무 메시지도 추가하지 않아 existingMessages 사용'
                        });
                    } else {
                        // 중요: DOM 메시지 수가 기존 메시지 수보다 적으면 반드시 병합
                        // 더보기로 일부만 표시된 경우에도 모든 메시지를 보존해야 함
                        // 단, 삭제된 메시지는 제외해야 함
                        // 
                        // 삭제된 메시지 판단:
                        // 1. DOM에 있는 메시지는 살아있음 (편집된 경우 최신 내용)
                        // 2. DOM에 없지만 send_date가 DOM의 마지막 메시지보다 이전이면 더보기로 숨겨진 메시지
                        // 3. DOM에 없고 send_date가 DOM의 마지막 메시지보다 이후면 삭제된 메시지 (regenerateMessage 등)
                        const chatUuids = new Set();
                        if (this.chat && this.chat.length > 0) {
                            this.chat.forEach(msg => {
                                if (msg.uuid) {
                                    chatUuids.add(msg.uuid);
                                }
                            });
                        }
                        
                        // 중요: this.chat이 비어있거나 로드되지 않았을 때도 existingMessages가 있으면 병합
                        // 단, 삭제된 메시지(_deletedMessageUuids에 포함)는 제외
                        if (chatUuids.size === 0) {
                            // this.chat이 비어있지만 existingMessages가 있으면 병합
                            if (missingMessages.length > 0 || existingMessages.length > (domMessages || []).length) {
                                // DOM 메시지는 최신 내용을 반영하므로 우선 사용
                                const domMessageMap = new Map();
                                (domMessages || []).forEach(msg => {
                                    if (msg.uuid) {
                                        domMessageMap.set(msg.uuid, msg);
                                    }
                                });
                                
                                // DOM 메시지 + DOM에 없는 기존 메시지 병합
                                // DOM 메시지가 우선이므로, 기존 메시지 중 DOM에 없는 것만 추가
                                const mergedMessages = [...(domMessages || [])];
                                missingMessages.forEach(msg => {
                                    if (!domMessageMap.has(msg.uuid)) {
                                        mergedMessages.push(msg);
                                    }
                                });
                                
                                // send_date 기준 정렬 (원본 순서 유지)
                                mergedMessages.sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                                messages = mergedMessages;
                                
                                console.log('[ChatManager.saveChat] ⚠️ this.chat이 비어있지만 existingMessages 병합:', {
                                    domMessageCount: (domMessages || []).length,
                                    existingMessageCount: existingMessages.length,
                                    missingMessageCount: missingMessages.length,
                                    mergedMessageCount: messages.length,
                                    reason: 'this.chat이 비어있지만 existingMessages가 있어 병합'
                                });
                            } else {
                                // existingMessages가 없거나 DOM 메시지와 동일하면 DOM 메시지만 사용
                                messages = domMessages || [];
                                console.log('[ChatManager.saveChat] ⚠️ this.chat이 비어있고 병합 불필요, DOM 메시지만 사용:', {
                                    domMessageCount: (domMessages || []).length,
                                    existingMessageCount: existingMessages.length,
                                    reason: 'this.chat이 비어있고 병합 불필요'
                                });
                            }
                        } else if (missingMessages.length > 0 || existingMessages.length > (domMessages || []).length) {
                            // DOM 메시지는 최신 내용을 반영하므로 우선 사용
                            const domMessageMap = new Map();
                            (domMessages || []).forEach(msg => {
                                if (msg.uuid) {
                                    domMessageMap.set(msg.uuid, msg);
                                }
                            });
                            
                            // DOM의 마지막 메시지 send_date 찾기 (삭제 판단 기준)
                            const lastDomMessageDate = (domMessages || []).length > 0 
                                ? Math.max(...(domMessages || []).map(msg => msg.send_date || 0))
                                : 0;
                            
                            // 중요: this.chat이 단일 소스이므로, this.chat에 없는 메시지는 삭제된 것으로 간주
                            messages = existingMessages
                                .filter(existingMsg => {
                                    // DOM에 있으면 포함 (편집된 경우 최신 내용)
                                    if (existingMsg.uuid && domMessageMap.has(existingMsg.uuid)) {
                                        return true;
                                    }
                                    // DOM에 없지만 this.chat에 있으면 더보기로 숨겨진 메시지로 간주하여 포함
                                    if (existingMsg.uuid && chatUuids.has(existingMsg.uuid)) {
                                        return true;
                                    }
                                    // DOM에 없고 this.chat에도 없으면 삭제된 메시지 (제외)
                                    if (existingMsg.uuid && this._deletedMessageUuids && this._deletedMessageUuids.has(existingMsg.uuid)) {
                                        // 삭제된 메시지로 간주하여 제외
                                        return false;
                                    }
                                    // send_date가 DOM의 마지막 메시지보다 이전이면 더보기로 숨겨진 메시지일 수 있음
                                    // 하지만 this.chat에 없으면 삭제된 것으로 간주 (리롤 후 새 메시지 생성 시)
                                    if (existingMsg.send_date && existingMsg.send_date < lastDomMessageDate) {
                                        // this.chat에 없으면 삭제된 메시지로 간주하여 제외
                                        // (리롤로 인해 this.chat에서 제거되었을 수 있음)
                                        return false;
                                    }
                                    // send_date가 없거나 DOM의 마지막 메시지보다 이후면 삭제된 메시지로 간주하여 제외
                                    return false;
                                })
                                .map(existingMsg => {
                                    // DOM에 있는 메시지는 DOM의 최신 내용 사용
                                    if (existingMsg.uuid && domMessageMap.has(existingMsg.uuid)) {
                                        return domMessageMap.get(existingMsg.uuid);
                                    }
                                    // DOM에 없는 메시지는 기존 메시지 사용 (더보기로 숨겨진 메시지)
                                    return existingMsg;
                                });
                            
                            // send_date 기준으로 정렬 (순서 보장)
                            messages.sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                            
                            console.debug('[ChatManager.saveChat] ✅ 병합 완료:', {
                                totalMessages: messages.length,
                                domMessages: (domMessages || []).length,
                                existingMessages: existingMessages.length,
                                chatArrayLength: this.chat?.length || 0,
                                deletedMessages: existingMessages.length - messages.length,
                                lastDomMessageDate,
                                chatUuidsCount: chatUuids.size
                            });
                        } else {
                            // 모든 메시지가 DOM에 있으면 DOM 메시지만 사용
                            messages = domMessages || [];
                            console.debug('[ChatManager.saveChat] ⚠️ 병합 불필요 (모든 메시지가 DOM에 있음):', {
                                totalMessages: messages.length,
                                domMessages: (domMessages || []).length
                            });
                        }
                    }
                } else {
                    // IndexedDB에 기존 메시지가 없으면 DOM 메시지만 사용
                    // 단, existingChatData가 있으면 병합 로직을 거쳐야 함 (삭제된 메시지 제외)
                    // currentChatId가 null이지만 existingChatData가 있으면 chatId 복원
                    if (existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                        // currentChatId가 null이면 chatId 복원
                        if (!this.currentChatId && chatId) {
                            this.currentChatId = chatId;
                            console.log('[ChatManager.saveChat] currentChatId 복원:', {
                                chatId: chatId.substring(0, 30)
                            });
                        }
                        // existingChatData가 있으면 병합 로직 사용 (삭제된 메시지 제외)
                        // 중요: domMessages가 null이면 this.chat을 사용 (리롤 후 새 메시지 생성 시)
                        if (domMessages === null && this.chat && this.chat.length > 0) {
                            domMessages = this.chat.map(msg => ({
                                ...msg,
                                uuid: msg.uuid,
                                send_date: msg.send_date || Date.now()
                            }));
                            console.debug('[ChatManager.saveChat] this.chat을 domMessages로 사용 (리롤 후 새 메시지 - else 블록):', {
                                chatArrayLength: this.chat.length,
                                domMessagesLength: domMessages.length
                            });
                        }
                        // 삭제된 메시지를 제외한 기존 메시지 필터링
                        const existingMessages = (existingChatData.messages || []).filter(msg => {
                            // _deletedMessageUuids에 포함된 메시지는 제외
                            if (msg.uuid && this._deletedMessageUuids && this._deletedMessageUuids.has(msg.uuid)) {
                                return false;
                            }
                            return true;
                        });
                        const domMessageUuids = new Set((domMessages || []).map(msg => msg.uuid).filter(uuid => uuid));
                        
                        // DOM에 없는 메시지는 IndexedDB에서 가져와서 병합
                        const missingMessages = existingMessages.filter(msg => {
                            if (!msg.uuid) return false;
                            return !domMessageUuids.has(msg.uuid);
                        });
                        
                        const chatUuids = new Set();
                        if (this.chat && this.chat.length > 0) {
                            this.chat.forEach(msg => {
                                if (msg.uuid) {
                                    chatUuids.add(msg.uuid);
                                }
                            });
                        }
                        
                        // 중요: this.chat이 비어있거나 로드되지 않았을 때는 DOM 메시지만 사용
                    // (삭제된 메시지가 포함되지 않도록 하기 위함)
                    if (chatUuids.size === 0) {
                        // this.chat이 비어있으면 DOM 메시지만 사용 (삭제된 메시지 제외)
                        // 중요: domMessages가 null이면 this.chat을 사용 (리롤 후 새 메시지 생성 완료 시)
                        if (domMessages === null && this.chat && this.chat.length > 0) {
                            messages = [...this.chat];
                            console.debug('[ChatManager.saveChat] this.chat을 사용 (chatUuids.size === 0 - 리롤 후 새 메시지):', {
                                chatArrayLength: this.chat.length,
                                messagesCount: messages.length
                            });
                        } else {
                            messages = domMessages || [];
                            console.debug('[ChatManager.saveChat] ⚠️ this.chat이 비어있어 DOM 메시지만 사용 (삭제된 메시지 제외):', {
                                domMessageCount: (domMessages || []).length,
                                existingMessageCount: existingMessages.length,
                                reason: 'this.chat이 비어있어 병합 불가'
                            });
                        }
                    } else if (missingMessages.length > 0 || existingMessages.length > (domMessages || []).length) {
                        // DOM 메시지 수가 기존 메시지 수보다 적으면 반드시 병합
                        const domMessageMap = new Map();
                        (domMessages || []).forEach(msg => {
                            if (msg.uuid) {
                                domMessageMap.set(msg.uuid, msg);
                            }
                        });
                        
                        const lastDomMessageDate = (domMessages || []).length > 0 
                            ? Math.max(...(domMessages || []).map(msg => msg.send_date || 0))
                            : 0;
                        
                        messages = existingMessages
                            .filter(existingMsg => {
                                // DOM에 있으면 포함 (편집된 경우 최신 내용)
                                if (existingMsg.uuid && domMessageMap.has(existingMsg.uuid)) {
                                    return true;
                                }
                                // DOM에 없지만 this.chat에 있으면 더보기로 숨겨진 메시지로 간주하여 포함
                                if (existingMsg.uuid && chatUuids.has(existingMsg.uuid)) {
                                    return true;
                                }
                                // DOM에 없고 this.chat에도 없으면 삭제된 메시지 (제외)
                                // _deletedMessageUuids도 확인하지만, this.chat이 더 우선순위가 높음
                                if (existingMsg.uuid && this._deletedMessageUuids && this._deletedMessageUuids.has(existingMsg.uuid)) {
                                    return false;
                                }
                                // send_date가 DOM의 마지막 메시지보다 이전이면 더보기로 숨겨진 메시지일 수 있음
                                // 하지만 this.chat에 없으면 삭제된 것으로 간주 (리롤 후 새 메시지 생성 시)
                                if (existingMsg.send_date && existingMsg.send_date < lastDomMessageDate) {
                                    // this.chat에 없으면 삭제된 메시지로 간주하여 제외
                                    // (리롤로 인해 this.chat에서 제거되었을 수 있음)
                                    return false;
                                }
                                // send_date가 없거나 DOM의 마지막 메시지보다 이후면 삭제된 메시지로 간주하여 제외
                                return false;
                            })
                            .map(existingMsg => {
                                // DOM에 있는 메시지는 DOM의 최신 내용 사용
                                if (existingMsg.uuid && domMessageMap.has(existingMsg.uuid)) {
                                    return domMessageMap.get(existingMsg.uuid);
                                }
                                // DOM에 없는 메시지는 기존 메시지 사용 (더보기로 숨겨진 메시지)
                                return existingMsg;
                            });
                        
                        messages.sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                        
                        console.debug('[ChatManager.saveChat] ✅ 병합 완료 (existingChatData 있음):', {
                            totalMessages: messages.length,
                            domMessages: (domMessages || []).length,
                            existingMessages: existingMessages.length,
                            deletedMessages: existingMessages.length - messages.length
                        });
                    } else {
                        // 모든 메시지가 DOM에 있으면 DOM 메시지만 사용
                        messages = domMessages || [];
                        console.debug('[ChatManager.saveChat] ⚠️ 병합 불필요 (모든 메시지가 DOM에 있음):', {
                            totalMessages: messages.length,
                            domMessages: (domMessages || []).length
                        });
                    }
                } else {
                    // existingChatData가 없거나 메시지가 없으면 this.chat 또는 DOM 메시지 사용
                    // 중요: 리롤 후 새 메시지 생성 완료 시 this.chat에 메시지가 있으면 그것을 사용
                    if (domMessages === null && this.chat && this.chat.length > 0) {
                        messages = [...this.chat];
                        console.debug('[ChatManager.saveChat] this.chat을 사용 (기존 채팅 데이터 없음 - 리롤 후 새 메시지):', {
                            chatArrayLength: this.chat.length,
                            messagesCount: messages.length
                        });
                    } else {
                        messages = domMessages || messages;
                        console.debug('[ChatManager.saveChat] ⚠️ 기존 채팅 데이터 없음, DOM 메시지만 저장:', {
                            domMessageCount: domMessages ? domMessages.length : 0,
                            messagesCount: messages.length,
                            chatArrayLength: this.chat ? this.chat.length : 0,
                            currentChatId: this.currentChatId?.substring(0, 30),
                            chatId: chatId?.substring(0, 30),
                            hasExistingChatData: !!existingChatData
                        });
                    }
                }
            }
            
            // 안전장치: DOM에서 메시지가 없는데 this.chat에는 메시지가 있으면 경고 (domMessages가 수집된 경우에만)
            if (domMessages !== null && domMessages.length === 0 && this.chat && this.chat.length > 0) {
                console.warn('[ChatManager.saveChat] DOM에는 메시지가 없지만 this.chat에는 메시지가 있음:', {
                    domMessageCount: domMessages.length,
                    chatArrayLength: this.chat.length,
                    chatUuids: this.chat.map(msg => msg.uuid?.substring(0, 8) || 'no-uuid')
                });
            }
                
            // UUID가 없는 메시지에 새 UUID 생성 (안전장치)
            messages.forEach(msg => {
                if (!msg.uuid) {
                    msg.uuid = uuidv4();
                }
            });
            
            // 중요: UUID 기준으로 중복 메시지 제거 (메시지 개수 카운팅 정확도 향상)
            const seenUuids = new Set();
            const deduplicatedMessages = [];
            for (const msg of messages) {
                if (msg.uuid && !seenUuids.has(msg.uuid)) {
                    seenUuids.add(msg.uuid);
                    deduplicatedMessages.push(msg);
                } else if (!msg.uuid) {
                    // UUID가 없는 메시지는 그대로 포함 (위에서 UUID 생성했으므로 거의 없을 것)
                    deduplicatedMessages.push(msg);
                }
            }
            messages = deduplicatedMessages;
            
            // 메시지 카운트 업데이트
            messageCount = messages.length;
            
            // 디버깅: messages가 비어있는데 this.chat에는 메시지가 있으면 경고
            if (messages.length === 0 && this.chat && this.chat.length > 0) {
                console.debug('[ChatManager.saveChat] ⚠️ messages가 비어있는데 this.chat에는 메시지가 있음:', {
                    messagesLength: messages.length,
                    chatArrayLength: this.chat.length,
                    chatUuids: this.chat.map(msg => msg.uuid?.substring(0, 8) || 'no-uuid'),
                    existingChatData: existingChatData ? { hasMessages: !!existingChatData.messages, messageCount: existingChatData.messages?.length || 0 } : null,
                    domMessages: domMessages ? { length: domMessages.length, uuids: domMessages.map(msg => msg.uuid?.substring(0, 8) || 'no-uuid') } : null
                });
                
                // ⚠️ 중요: this.chat이 단일 소스이므로 직접 사용
                // (불러온 채팅도 불러온 직후부터는 일반 채팅처럼 this.chat이 단일 소스)
                messages = [...this.chat];
                // 삭제된 메시지만 제외
                if (this._deletedMessageUuids && this._deletedMessageUuids.size > 0) {
                    messages = messages.filter(msg => {
                        if (msg.uuid && this._deletedMessageUuids.has(msg.uuid)) {
                            return false;
                        }
                        return true;
                    });
                }
                messageCount = messages.length;
                
                console.debug('[ChatManager.saveChat] this.chat을 사용하여 messages 복구:', {
                    messagesCount: messages.length,
                    chatArrayLength: this.chat.length,
                    deletedMessageCount: this._deletedMessageUuids ? this._deletedMessageUuids.size : 0
                });
            }
            
            // 필터링된 existingMessages 길이 계산 (삭제된 메시지 제외)
            let filteredExistingMessagesLength = 0;
            if (existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
                // _deletedMessageUuids에 포함된 메시지를 제외한 길이 계산
                filteredExistingMessagesLength = existingChatData.messages.filter(msg => {
                    if (msg.uuid && this._deletedMessageUuids && this._deletedMessageUuids.has(msg.uuid)) {
                        return false;
                    }
                    return true;
                }).length;
            }
            
            console.debug('[ChatManager.saveChat] 메시지 수집 완료:', {
                messageCount: messages.length,
                chatArrayLength: this.chat ? this.chat.length : 0,
                domMessagesLength: domMessages ? domMessages.length : 0,
                existingMessagesLength: filteredExistingMessagesLength,
                originalExistingMessagesLength: existingChatData?.messages?.length || 0,
                deletedMessageUuidsCount: this._deletedMessageUuids ? this._deletedMessageUuids.size : 0,
                firstMessage: messages[0] ? { send_date: messages[0].send_date, uuid: messages[0].uuid?.substring(0, 8), mes: messages[0].mes?.substring(0, 50) } : null,
                lastMessage: messages[messages.length - 1] ? { send_date: messages[messages.length - 1].send_date, uuid: messages[messages.length - 1].uuid?.substring(0, 8), mes: messages[messages.length - 1].mes?.substring(0, 50) } : null
            });
            
            // 메타데이터 생성 (기존 메타데이터 보존)
            const existingMetadata = existingChatData?.metadata || {};
            // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
            // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, 저장 시 특별 처리할 필요가 없습니다.
            // 기존 코드 (주석 처리):
            // const isImportedBeforeSave = existingMetadata?.isImported === true;
            // const { isImported, imported_date, ...restMetadata } = existingMetadata;
            // 실리태번 방식: 기존 메타데이터를 그대로 사용 (isImported 플래그 없음)
            const metadata = {
                user_name: existingMetadata.user_name || 'User',
                character_name: characterName,
                characterId: this.currentCharacterId, // 필수: 채팅 필터링에 사용 (이중 저장)
                create_date: existingMetadata.create_date || this.chatCreateDate || Date.now(), // 기존 생성 날짜 보존
                chat_metadata: {
                    ...existingMetadata.chat_metadata,
                    ...withMetadata, // 새로운 메타데이터가 있으면 추가/덮어쓰기
                },
            };

            // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 그리팅 필터링 불필요
            // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, 저장 시 그리팅을 필터링할 필요가 없습니다.
            // 불러온 채팅은 이미 메시지가 있으므로 그리팅이 자동으로 추가되지 않습니다.
            // 기존 코드 (주석 처리):
            // if (isImportedBeforeSave && existingChatData && existingChatData.messages && existingChatData.messages.length > 0) {
            //     ... 그리팅 필터링 로직 ...
            // }
            // 실리태번 방식: messages를 그대로 저장
            let messagesToSave = messages;

            // 채팅 데이터 구성 (기존 데이터 보존)
            // characterId를 최상위와 metadata 모두에 저장하여 안전성 확보
            const chatData = {
                characterId: this.currentCharacterId, // 필수: 채팅 필터링에 사용
                chatName: finalChatName,
                metadata, // metadata에도 characterId 포함
                messages: messagesToSave,
                // lastMessageDate: 메시지가 있으면 마지막 메시지의 send_date 사용, 없으면 기존 값 유지
                lastMessageDate: messagesToSave.length > 0 ? (() => {
                    // send_date 기준으로 정렬하여 마지막 메시지 찾기
                    const sortedMessages = [...messagesToSave].sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                    const lastMessage = sortedMessages[sortedMessages.length - 1];
                    // send_date가 있으면 사용, 없으면 다른 필드 시도
                    return lastMessage.send_date || 
                           lastMessage.date || 
                           lastMessage.timestamp || 
                           Date.now(); // fallback으로 현재 시간
                })() : (existingChatData?.lastMessageDate || null),
            };

            // 저장 (덮어쓰기 확인)
            // 중요: ChatStorage.save와 CharacterStorage.save를 순차적으로 실행하여
            // 한쪽이 완료되지 않아도 최소한 한쪽은 저장되도록 함
            
            // 안전장치: DOM에서 메시지가 없으면 messages 배열도 비어있어야 함
            // 하지만 DOM에서 메시지를 수집했으므로 이미 messages는 DOM과 일치함
            // 이 체크는 추가 안전장치일 뿐
            if (messages.length === 0) {
                console.debug('[ChatManager.saveChat] 메시지가 0개인 채팅 저장:', {
                    chatId,
                    chatName: finalChatName
                });
            }
            
            await ChatStorage.save(chatId, chatData);
            
            // 저장 후 IndexedDB에 실제로 저장되었는지 확인 (디버깅)
            // console.debug 대신 console.log 사용하여 필터링되지 않도록 함
            const verifySaved = await ChatStorage.load(chatId);
            if (verifySaved) {
                const savedMessageCount = verifySaved.messages?.length || 0;
                if (savedMessageCount !== messages.length) {
                    console.warn('[ChatManager.saveChat] ⚠️ IndexedDB 저장 확인 불일치:', {
                        expectedCount: messages.length,
                        actualCount: savedMessageCount,
                        chatId: chatId.substring(0, 50),
                        savedUuids: verifySaved.messages?.map(m => m.uuid?.substring(0, 8) || 'no-uuid') || []
                    });
                } else {
                    console.debug('[ChatManager.saveChat] ✅ IndexedDB 저장 확인:', {
                        messageCount: savedMessageCount,
                        chatId: chatId.substring(0, 50),
                        savedUuids: verifySaved.messages?.map(m => m.uuid?.substring(0, 8) || 'no-uuid') || []
                    });
                }
            } else {
                console.warn('[ChatManager.saveChat] ⚠️ IndexedDB에서 채팅을 찾을 수 없음:', {
                    chatId: chatId.substring(0, 50)
                });
            }
            
            // 중요: saveChat 후 this.chat 배열을 저장된 messages와 동기화
            // DOM에서 메시지를 수집했으므로, this.chat도 DOM과 일치하도록 업데이트
            // 이렇게 하면 삭제된 메시지가 this.chat에 남아있지 않음
            this.chat = [...messages]; // 저장된 messages 배열로 this.chat 업데이트
            
            // 디버깅: 동기화 확인
            if (this.chat.length !== messages.length) {
                console.warn('[ChatManager.saveChat] this.chat 동기화 불일치:', {
                    chatLength: this.chat.length,
                    messagesLength: messages.length
                });
            }
            
            // 캐릭터에 현재 채팅 정보 저장
            // character.chat를 업데이트하지 않으면 loadOrCreateChat에서 채팅을 찾지 못할 수 있음
            character.chat = finalChatName;
            character.date_last_chat = Date.now();
            try {
                await CharacterStorage.save(this.currentCharacterId, character);
            } catch (error) {
                // CharacterStorage 저장 실패해도 ChatStorage는 이미 저장되었으므로 경고만 출력
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20014', 'CharacterStorage 저장 실패 (ChatStorage는 저장됨)', error);
                }
            }

            // 현재 채팅 ID와 이름 업데이트
            this.currentChatId = chatId;
            this.currentChatName = finalChatName;
            
            // 현재 채팅 ID 저장 (복원용)
            try {
                await ChatStorage.saveCurrent(chatId);
            } catch (error) {
                console.warn('[ChatManager.saveChat] currentChatId 저장 실패:', error);
            }
            
            // messageCount 저장 (finally 블록에서 사용하기 위해)
            messageCount = messages.length;
            
            // 저장 완료 후 삭제된 메시지 UUID 추적 해제 (다음 저장 시에는 영향 없도록)
            // 리롤 시 삭제된 메시지가 재추가되지 않도록 하기 위해 사용했지만, 저장 완료 후에는 해제해야 함
            if (this._deletedMessageUuids && this._deletedMessageUuids.size > 0) {
                this._deletedMessageUuids.clear();
            }
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3007', '채팅 저장 중 오류가 발생했습니다', error);
            }
            throw error;
        } finally {
            // 저장 완료 플래그 해제
            this._isSavingChat = false;
            
            // ⚠️ 중요: 새 채팅 생성 플래그 해제 (저장 완료 후)
            if (this._isNewChatCreated) {
                this._isNewChatCreated = false;
                console.debug('[ChatManager.saveChat] 새 채팅 생성 플래그 해제');
            }
            
            // 채팅 목록 패널이 열려있으면 자동 새로고침 (메시지가 1개 이상일 때만)
            // 비동기로 처리하여 저장 성능에 영향 없도록
            if (messageCount > 0 && window.panelManager) {
                requestAnimationFrame(() => {
                    window.panelManager.refreshChatListPanel(this.currentCharacterId).catch(error => {
                        console.debug('[ChatManager.saveChat] 채팅 목록 패널 새로고침 오류:', error);
                    });
                });
            }
        }
    }

    /**
     * 채팅 로드
     * 
     * ⚠️ 중요: 이 함수는 다음 기능들과 강하게 연동되어 있습니다.
     * 
     * [연동 기능]
     * 1. messagesToLoad 설정: 최근 N개만 표시 (startIndex 계산)
     *    * if (chat.length > count) { startIndex = chat.length - count; }
     * 2. 더보기 버튼: startIndex > 0이면 더보기 버튼 추가 (addLoadMoreButton)
     * 3. htmlRenderLimit: 역순 인덱스 기준으로 최근 N개만 HTML 렌더링
     *    * ⚠️ 중요: HTML 렌더링 제한이 정규식보다 우선 적용됨
     *    * 정규식은 먼저 적용되지만, 렌더링 제한에 의해 최근 N개가 아닌 메시지는 플레이스홀더로 표시됨
     * 4. character.chat 업데이트: 불러온 채팅이 가장 최근이 되도록 (loadOrCreateChat 연동)
     *    * try 블록 끝에서 실행 보장 (채팅 로드 완료 후)
     * 5. 정규식: 모든 메시지 렌더링 시 getRegexedString 호출 (isMarkdown: true)
     *    * 정규식 적용 후 HTML 렌더링 제한 적용
     * 
     * [수정 시 주의사항]
     * - startIndex 계산 변경 시 → loadMoreMessagesFromStart의 endIndex 계산도 함께 수정
     * - 더보기 버튼 표시 조건 변경 시 → addLoadMoreButton 호출 위치 확인
     * - htmlRenderLimit 적용 위치 변경 시 → loadMoreMessagesFromStart에도 동일하게 적용
     *   * ⚠️ 중요: 정규식 적용 후 HTML 렌더링 제한 적용 순서 유지
     * - character.chat 업데이트 위치 변경 시 → try 블록 끝에서 실행 보장 (채팅 로드 완료 후)
     * - 정규식과 HTML 렌더링 제한: 모든 메시지 렌더링 시 정규식 적용 후 HTML 렌더링 제한 적용
     * 
     * @param {string} chatId - 로드할 채팅 ID
     * @param {boolean} isEmptyChat - 메시지가 0개인 채팅인지 (규칙 5: 새로고침 후 돌아오면 그리팅 추가)
     */
    async loadChat(chatId, isEmptyChat = false) {
        // 로딩 중 플래그 설정 (저장 방지)
        this._isLoadingChat = true;
        
        try {
        // ChatStorage - 전역 스코프에서 사용
        const chatData = await ChatStorage.load(chatId);

        if (!chatData) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20015', `채팅을 찾을 수 없음: ${chatId}`);
            }
            // 로딩 플래그 해제 (finally 블록 실행 전)
            this._isLoadingChat = false;
            return;
        }

        // 다른 채팅으로 전환하는 경우 기존 채팅 저장 (덮어쓰기 방지)
        if (this.currentChatId && this.currentChatId !== chatId) {
            // 기존 채팅 저장 (다른 채팅 로드 전)
            if (this.elements.chatMessages.children.length > 0) {
                try {
                    await this.saveChat();
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_CHAT_3009', '기존 채팅 저장 중 오류가 발생했습니다', error);
                    }
                    // 저장 실패해도 계속 진행 (사용자 경험 우선)
                }
            }
        }

        // 캐릭터가 다른 경우 강제 초기화
        if (this.currentCharacterId && this.currentCharacterId !== chatData.characterId) {
            if (this.elements && this.elements.chatMessages) {
                this.elements.chatMessages.innerHTML = '';
                // DOM 업데이트 대기
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
        }

        // 채팅 초기화
        this.elements.chatMessages.innerHTML = '';
        
        // DOM 업데이트 대기 (초기화가 완전히 반영되도록)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // 메타데이터 저장
        this.currentChatId = chatId;
        this.currentChatName = chatData.chatName;
        // ⚠️ 중요: this.currentCharacterId 설정 (메시지 렌더링 시 정규식 적용을 위해 필요)
        // 이유: addMessage에서 정규식을 적용하려면 this.currentCharacterId가 필요함
        // loadChat이 직접 호출되는 경우(채팅 목록에서 선택 등)에도 정규식이 적용되도록 함
        // 이전에 제거했던 이유: 비동기 작업 중 다른 캐릭터 선택 가능성
        // 하지만 addMessage에서 정규식 적용을 위해 필요하므로 복원
        // 대안: addMessage에 characterId 매개변수 추가 (더 큰 수정 필요)
        this.currentCharacterId = chatData.characterId;
        this.chatCreateDate = chatData.metadata.create_date || Date.now();
        
        // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅과 동일하게 처리
        // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으며, chat.length === 0 조건만으로 그리팅 추가 여부를 결정합니다.
        // 기존 코드 (주석 처리):
        // if (chatData.metadata?.isImported) {
        //     this._isImportedChat = true;
        //     console.debug('[ChatManager.loadChat] 불러온 채팅 감지 (저장 시 일반 채팅으로 변환됨):', {
        //         chatId: chatId.substring(0, 50),
        //         messageCount: chatData.messages?.length || 0
        //     });
        // } else {
        //     this._isImportedChat = false;
        // }
        // 실리태번 방식: 불러온 채팅도 일반 채팅처럼 취급 (플래그 없음)

            // 실리태번과 동일: 전체 메시지를 chat 배열에 저장 (인덱스 0부터 시작)
            // 메시지 순서는 저장 시 이미 확정됨 (불러오기 시 파일 순서 유지)
        let messages = chatData.messages || [];
        // 정렬 제거: 저장 시 이미 올바른 순서로 저장되어 있음
            
            // 실리태번과 동일: chat 배열에 전체 메시지 저장 (헤더 제거 없이 메시지만)
            // 실리태번의 getChat(): chat.splice(0, chat.length, ...response), chat.shift() 와 유사
            // 우리는 이미 헤더가 분리되어 있으므로 메시지만 chat 배열에 저장
            this.chat = [...messages]; // 배열 복사 (원본 보호)
            this.chat_metadata = chatData.metadata || {}; // 실리태번과 동일: chat_metadata 저장
        
        // 캐릭터 정보 가져오기 (아바타 포함)
        // CharacterStorage - 전역 스코프에서 사용
        // ⚠️ 중요: chatData.characterId를 직접 사용 (this.currentCharacterId는 설정하지 않음)
        let character = await CharacterStorage.load(chatData.characterId);
        // 캐릭터를 찾을 수 없으면 (삭제된 경우), SettingsStorage에서 현재 선택된 캐릭터로 폴백
        if (!character) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20016', '채팅 캐릭터 정보 없음, 현재 캐릭터로 대체');
            }
            // SettingsStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            const currentCharId = settings.currentCharacterId;
            if (currentCharId && currentCharId !== chatData.characterId) {
                character = await CharacterStorage.load(currentCharId);
                // ⚠️ 중요: this.currentCharacterId는 설정하지 않음 (selectCharacter에서만 설정)
            }
        }
        
        const characterName = character?.data?.name || character?.name || chatData.metadata?.character_name || 'Character';
        // 캐릭터 아바타 가져오기 (여러 위치 확인) - 최신 로직 사용
        const characterAvatar = character?.avatar_image || 
                               character?.avatarImage || 
                               character?.data?.avatar_image ||
                               character?.data?.avatarImage ||
                               (character?.avatar && character.avatar !== 'none' ? character.avatar : null) ||
                               null;
        
        // 설정에서 로딩할 메시지 수 가져오기
        // SettingsStorage - 전역 스코프에서 사용 (이미 위에서 로드했을 수 있으므로 다시 로드)
        const chatSettings = await SettingsStorage.load();
            // messagesToLoad가 0이거나 undefined이면 모든 메시지 표시 (실리태번 기본값)
            // 그렇지 않으면 설정된 값 사용
            const messagesToLoad = chatSettings.messagesToLoad;
            
            // 실리태번과 동일: printMessages() 로직 적용
            // 실리태번: let startIndex = 0; let count = power_user.chat_truncation || Number.MAX_SAFE_INTEGER;
            // if (chat.length > count) { startIndex = chat.length - count; }
            // for (let i = startIndex; i < chat.length; i++) { addOneMessage(chat[i], { forceId: i }) }
        let startIndex = 0;
            // messagesToLoad가 0이거나 undefined/null이면 모든 메시지 표시
            let count = (messagesToLoad !== undefined && messagesToLoad !== null && messagesToLoad > 0) 
                ? messagesToLoad 
                : Number.MAX_SAFE_INTEGER;
            
            // 실리태번과 동일: chat.length > count 이면 startIndex = chat.length - count
            // 실리태번: if (chat.length > count) { startIndex = chat.length - count; }
            // 단순하게 startIndex부터 끝까지 렌더링 (인덱스 0을 특별히 처리하지 않음)
            if (this.chat.length > count) {
                startIndex = this.chat.length - count;
            } else {
                // 메시지 수가 count 이하면 모든 메시지 표시
                startIndex = 0;
            }
            
            console.debug('[ChatManager.loadChat] 메시지 렌더링 정보:', {
                totalMessages: this.chat.length,
                messagesToLoad: count,
                calculatedStartIndex: this.chat.length > count ? this.chat.length - count : 0,
                startIndex,
                willRenderFrom: startIndex,
                willRenderTo: this.chat.length - 1,
                willRenderCount: this.chat.length - startIndex,
                firstMessageIndex: 0,
                willIncludeFirstMessage: startIndex <= 1
            });
        
        // HTML 렌더링 제한 가져오기
        const htmlRenderLimit = chatSettings.htmlRenderLimit ?? 0;
        
            // 실리태번과 동일: for (let i = startIndex; i < chat.length; i++)
            // 인덱스 0을 항상 포함하려면, 인덱스 0부터 시작하여 startIndex까지도 렌더링
        const messageWrappers = [];
            const renderedIndexes = new Set(); // 이미 렌더링된 인덱스 추적
            
            // 기존 DOM 메시지의 UUID 집합 (중복 방지용)
            const existingUuids = new Set();
            this.elements.chatMessages.querySelectorAll('.message-wrapper').forEach(wrapper => {
                const uuid = wrapper.dataset.messageUuid;
                if (uuid) {
                    existingUuids.add(uuid);
                }
            });
            
            console.debug('[ChatManager.loadChat] 기존 DOM 메시지 UUID 수:', existingUuids.size);
            
            // 실리태번과 동일: for (let i = startIndex; i < chat.length; i++)
            // startIndex부터 끝까지 순서대로 렌더링 (단순하게)
            for (let i = startIndex; i < this.chat.length; i++) {
                const message = this.chat[i];
                if (!message) continue;
                
                // 이미 DOM에 있는 메시지는 건너뛰기 (중복 방지)
                if (message.uuid && existingUuids.has(message.uuid)) {
                    console.debug('[ChatManager.loadChat] 중복 메시지 건너뛰기:', {
                        index: i,
                        uuid: message.uuid.substring(0, 8),
                        send_date: message.send_date
                    });
                    renderedIndexes.add(i);
                    continue;
                }
                
                // 실리태번과 동일: force_avatar 가져오기 (유저 메시지에만)
                // force_avatar가 페르소나 이름일 수 있으므로 실제 아바타 이미지 URL로 변환
                let userAvatar = message.force_avatar || null;
                
                // 유저 메시지인 경우 페르소나 아바타 처리
                if (message.is_user) {
                    // force_avatar가 있고 이미지 URL이 아닌 경우 처리
                    if (userAvatar && !userAvatar.startsWith('data:') && !userAvatar.startsWith('http://') && !userAvatar.startsWith('https://')) {
                        // 파일명 형식인지 확인 (예: 1758292739003-.png)
                        const isFilename = /^[\d\w]+[-_\.][\w\.]+$/.test(userAvatar) || userAvatar.includes('.png') || userAvatar.includes('.jpg') || userAvatar.includes('.jpeg');
                        
                        if (isFilename) {
                            // 파일명으로 페르소나 찾기
                            try {
                                const allPersonas = await UserPersonaStorage.loadAll();
                                let foundPersona = null;
                                const filenameWithoutExt = userAvatar.replace(/\.(png|jpg|jpeg)$/i, '');
                                
                                // 파일명과 일치하는 페르소나 찾기
                                for (const [personaId, persona] of Object.entries(allPersonas)) {
                                    if (persona?.avatar) {
                                        const avatarMatch = persona.avatar.match(/thumbnail[^"]*file=([^&"']+)/);
                                        if (avatarMatch && avatarMatch[1] === userAvatar) {
                                            foundPersona = persona;
                                            break;
                                        }
                                        if (persona.avatar.includes(userAvatar) || persona.avatar.includes(filenameWithoutExt)) {
                                            foundPersona = persona;
                                            break;
                                        }
                                    }
                                }
                                
                                // 페르소나 ID로 찾기 시도
                                if (!foundPersona && filenameWithoutExt) {
                                    for (const [personaId, persona] of Object.entries(allPersonas)) {
                                        if (personaId.includes(filenameWithoutExt) || filenameWithoutExt.includes(personaId)) {
                                            foundPersona = persona;
                                            break;
                                        }
                                    }
                                }
                                
                                if (foundPersona && foundPersona.avatar && (foundPersona.avatar.startsWith('data:') || foundPersona.avatar.startsWith('http://') || foundPersona.avatar.startsWith('https://'))) {
                                    userAvatar = foundPersona.avatar;
                                    console.debug('[ChatManager.loadChat] 파일명으로 페르소나 아바타 찾음:', {
                                        filename: message.force_avatar,
                                        personaName: foundPersona.name,
                                        hasAvatar: !!foundPersona.avatar
                                    });
                                } else {
                                    userAvatar = null; // 찾지 못하면 기본 아이콘 사용
                                }
                            } catch (e) {
                                console.debug('[ChatManager] 파일명으로 페르소나 찾기 실패:', e);
                                userAvatar = null;
                            }
                        } else {
                            // 파일명 형식이 아니면 페르소나 이름으로 찾기
                            try {
                                const allPersonas = await UserPersonaStorage.loadAll();
                                let foundPersona = null;
                                for (const [personaId, persona] of Object.entries(allPersonas)) {
                                    if (persona?.name === userAvatar || personaId === userAvatar) {
                                        foundPersona = persona;
                                        break;
                                    }
                                }
                                if (foundPersona && foundPersona.avatar) {
                                    userAvatar = foundPersona.avatar;
                                }
                            } catch (e) {
                                console.debug('[ChatManager] 페르소나 찾기 실패 (force_avatar), 원본 사용:', userAvatar);
                            }
                        }
                    }
                    
                    // force_avatar가 없거나 이미지 URL이 아닌 경우, message.name으로 페르소나 찾기 시도
                    if (!userAvatar || (!userAvatar.startsWith('data:') && !userAvatar.startsWith('http://') && !userAvatar.startsWith('https://'))) {
                        const userName = message.name || '';
                        if (userName) {
                            try {
                                const allPersonas = await UserPersonaStorage.loadAll();
                                // 메시지의 name 필드와 일치하는 페르소나 찾기
                                let foundPersona = null;
                                for (const [personaId, persona] of Object.entries(allPersonas)) {
                                    if (persona?.name === userName) {
                                        foundPersona = persona;
                                        break;
                                    }
                                }
                                // 페르소나가 찾아지고 아바타가 있으면 사용
                                if (foundPersona && foundPersona.avatar) {
                                    userAvatar = foundPersona.avatar;
                                    console.debug('[ChatManager.loadChat] message.name으로 페르소나 아바타 찾음:', {
                                        userName,
                                        personaName: foundPersona.name,
                                        hasAvatar: !!foundPersona.avatar
                                    });
                                }
                            } catch (e) {
                                console.debug('[ChatManager] 페르소나 찾기 실패 (message.name), 원본 사용:', userName);
                            }
                        }
                    }
                }
                
                // 실리태번과 동일: 메시지 고유 ID 및 send_date 가져오기
                const messageUuid = message.uuid || null;
                const sendDate = message.send_date || null;
                
                // 실리태번과 동일: 메시지의 name 필드 확인 (다른 캐릭터가 보낸 메시지 처리)
                let messageCharacterName = characterName;
                let messageCharacterAvatar = characterAvatar;
                
                if (!message.is_user && message.name) {
                    // 메시지의 name 필드가 characterName과 다른 경우 (다른 캐릭터가 보낸 메시지)
                    if (message.name !== characterName) {
                        messageCharacterName = message.name;
                        messageCharacterAvatar = null; // 다른 캐릭터는 기본 아이콘 사용
                    }
                }
                
                // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
                // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, 원본 이름 보존 로직도 제거합니다.
                // 기존 코드 (주석 처리):
                // const originalUserName = (this.chat_metadata?.isImported && message.is_user && message.name)
                //     ? message.name 
                //     : null;
                // 실리태번 방식: 원본 이름 보존 없이 현재 페르소나 이름 사용
                const originalUserName = null;
                
                const wrapper = await this.addMessage(
                    message.mes,
                    message.is_user ? 'user' : 'assistant',
                    message.is_user ? null : messageCharacterName,
                    message.is_user ? null : messageCharacterAvatar,
                    message.extra?.swipes || [],
                    0,
                    message.is_user ? userAvatar : null,
                    sendDate || null, // send_date 전달
                    message.extra?.reasoning || null, // 추론 내용 복원
                    originalUserName // 불러온 채팅의 원본 유저 이름
                );
                
                // 실리태번과 동일: 저장된 UUID와 send_date를 DOM에 복원 (구 메시지 호환)
                // 실리태번: addOneMessage(item, { forceId: i }) - 원본 배열 인덱스 저장
                if (messageUuid) {
                    wrapper.dataset.messageUuid = messageUuid;
                    existingUuids.add(messageUuid);
                }
                if (sendDate) {
                    wrapper.dataset.sendDate = sendDate.toString();
                }
                // 추론 내용도 dataset에 저장 (saveChat에서 읽기 위해)
                if (message.extra?.reasoning) {
                    wrapper.dataset.reasoning = message.extra.reasoning;
                }
                // 실리태번과 동일: 원본 배열 인덱스 저장 (forceId: i)
                wrapper.dataset.messageIndex = i.toString();
                
                messageWrappers.push(wrapper);
                renderedIndexes.add(i);
            }
            
                        console.debug('[ChatManager.loadChat] 렌더링 완료:', {
                renderedCount: messageWrappers.length,
                finalDOMCount: this.elements.chatMessages.querySelectorAll('.message-wrapper').length,
                firstMessageIndex: messageWrappers[0] ? (messageWrappers[0].dataset.messageIndex || messageWrappers[0].dataset.messageUuid?.substring(0, 8)) : null,
                lastMessageIndex: messageWrappers[messageWrappers.length - 1] ? (messageWrappers[messageWrappers.length - 1].dataset.messageIndex || messageWrappers[messageWrappers.length - 1].dataset.messageUuid?.substring(0, 8)) : null,
                renderedIndexes: Array.from(renderedIndexes).sort((a, b) => a - b),
                startIndex,
                totalMessages: this.chat.length
            });

        // 숨겨진 메시지가 있으면 "더보기" 버튼 추가
            // 실리태번과 동일: startIndex > 0이면 더 로드할 메시지가 있음
            // startIndex부터 끝까지 렌더링했으므로, 인덱스 0부터 startIndex-1까지가 숨겨진 메시지
            if (startIndex > 0 && this.chat.length > renderedIndexes.size) {
            // 채팅 데이터를 인스턴스에 저장 (더보기 버튼에서 사용)
            this._storedChatData = chatData;
            this._storedCharacterName = characterName;
            this._storedCharacterAvatar = characterAvatar;
            await this.addLoadMoreButton(startIndex, chatId);
        }
        
        // HTML 렌더링 제한 적용: 이미 로드된 모든 메시지에 제한 적용
            // DOM 업데이트 완료 대기 (모든 메시지가 DOM에 추가된 후)
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        
            // HTML 렌더링 제한 적용 함수
            const applyHtmlRenderLimit = async () => {
                const currentSettings = await SettingsStorage.load();
                const currentHtmlRenderLimit = currentSettings.htmlRenderLimit ?? 0;
                
                if (currentHtmlRenderLimit > 0) {
            const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
            
            // 역순 인덱스 계산: 최근 메시지가 인덱스 0, 1, 2...
            // 배열을 역순으로 순회 (최근 메시지부터)
            const reversedWrappers = [...allMessageWrappers].reverse();
            
            reversedWrappers.forEach((wrapper, reverseIndex) => {
                // reverseIndex가 0이면 최근 메시지, 1이면 그 다음 최근 메시지...
                const messageText = wrapper.querySelector('.message-text');
                
                if (messageText) {
                            if (reverseIndex >= currentHtmlRenderLimit) {
                        // 제한 범위를 벗어난 메시지는 플레이스홀더로 교체
                        this.renderHtmlIframesInElement(messageText, true);
                    } else {
                        // 제한 범위 내의 메시지는 렌더링 (플레이스홀더가 있으면 복원)
                        this.renderHtmlIframesInElement(messageText, false);
                    }
                }
            });
        } else {
            // htmlRenderLimit이 0이면 모든 메시지 렌더링 (플레이스홀더 복원)
            const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
            
            allMessageWrappers.forEach(wrapper => {
                const messageText = wrapper.querySelector('.message-text');
                if (messageText) {
                    this.renderHtmlIframesInElement(messageText, false);
                }
            });
        }
            };
            
            // HTML 렌더링 제한 적용
            await applyHtmlRenderLimit();

        // 스크롤을 맨 아래로 (비동기로 실행하여 블로킹 방지)
        // 여러 프레임 대기 후 스크롤 (DOM 렌더링 완료 대기)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.scrollToBottom(true);
                    // 추가로 몇 번 더 시도 (이미지 로딩 등 대기)
                    setTimeout(() => this.scrollToBottom(true), 300);
                    setTimeout(() => this.scrollToBottom(true), 600);
                    // 이미지 로딩 완료 후에도 확인
                    this.ensureScrollToBottomBackground();
                }, 100);
            });
        });
        
        // 인풋창 높이 리셋 (채팅 로드 후 인풋창이 비어있을 수 있으므로)
        if (this.elements && this.elements.messageInput) {
            const inputValue = this.elements.messageInput.value.trim();
            if (!inputValue) {
                // 인풋창이 비어있으면 높이 리셋
                this.elements.messageInput.style.height = '44px';
                this.elements.messageInput.offsetHeight;
            }
        }

        // 중요: character.chat 업데이트 (불러온 채팅이 가장 최근 채팅이 되도록)
        // try 블록 끝에서 실행하여 채팅 로드가 완전히 완료된 후에만 실행됨
        // 이렇게 하면 홈화면으로 나갔다가 다시 캐릭터를 선택할 때 불러온 채팅이 자동으로 로드됨
        // ⚠️ 중요: chatData.characterId를 직접 사용 (this.currentCharacterId는 비동기 중 변경될 수 있음)
        const chatCharacterId = chatData.characterId;
        if (chatCharacterId && this.currentChatName) {
            try {
                const character = await CharacterStorage.load(chatCharacterId);
                if (character) {
                    const oldChatName = character.chat;
                    character.chat = this.currentChatName;
                    await CharacterStorage.save(chatCharacterId, character);
                    console.debug('[ChatManager.loadChat] ✅ character.chat 업데이트 완료:', {
                        characterId: chatCharacterId,
                        oldChatName: oldChatName || '(none)',
                        newChatName: this.currentChatName,
                        chatId: chatId
                    });
                } else {
                    console.warn('[ChatManager.loadChat] ⚠️ 캐릭터를 찾을 수 없음:', chatCharacterId);
                }
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_CHAT_3016', 'character.chat 업데이트 실패', error);
                }
                console.error('[ChatManager.loadChat] ❌ character.chat 업데이트 실패:', error);
            }
        } else {
            console.warn('[ChatManager.loadChat] ⚠️ character.chat 업데이트 건너뜀:', {
                hasCharacterId: !!chatCharacterId,
                hasChatName: !!this.currentChatName,
                chatCharacterId: chatCharacterId,
                currentChatName: this.currentChatName
            });
        }

        // 규칙 5: 메시지가 0개인 채팅을 새로고침하거나 다른 곳에서 돌아오면 그리팅 추가
        // ⚠️ [실리태번 방식으로 변경] chat.length === 0 조건만으로 그리팅 추가 여부 결정
        // 실리태번은 불러온 채팅과 일반 채팅을 구분하지 않으며, 단순히 메시지가 없으면 그리팅을 추가합니다.
        // 불러온 채팅은 이미 메시지가 있으므로 자동으로 그리팅이 추가되지 않습니다.
        // 기존 코드 (주석 처리):
        // const isImportedChat = chatData.metadata?.isImported === true;
        // const storedMessageCount = chatData.messages ? chatData.messages.length : 0;
        // if (!isImportedChat && isEmptyChat && messages.length === 0 && storedMessageCount === 0) {
        // 실리태번 방식: messages.length === 0 조건만 확인
        if (isEmptyChat && messages.length === 0) {
            // 캐릭터 정보 다시 가져오기 (최신 상태)
            // ⚠️ 중요: chatData.characterId를 사용 (this.currentCharacterId는 설정하지 않으므로 사용하지 않음)
            const latestCharacter = await CharacterStorage.load(chatCharacterId);
            if (latestCharacter) {
                const firstMessage = latestCharacter?.data?.first_mes || latestCharacter?.first_mes || latestCharacter?.data?.first_message || '';
                const alternateGreetings = latestCharacter?.data?.alternate_greetings || latestCharacter?.alternate_greetings || [];
                
                // 캐릭터 아바타 가져오기
                const characterAvatar = latestCharacter?.avatar_image || 
                                       latestCharacter?.avatarImage || 
                                       latestCharacter?.data?.avatar_image ||
                                       latestCharacter?.data?.avatarImage ||
                                       (latestCharacter?.avatar && latestCharacter.avatar !== 'none' ? latestCharacter.avatar : null) ||
                                       null;
                
                if (firstMessage) {
                    // SettingsStorage, UserPersonaStorage, substituteParams - 전역 스코프에서 사용
                    const settings = await SettingsStorage.load();
                    let userName = 'User';
                    if (settings.currentPersonaId) {
                        const persona = await UserPersonaStorage.load(settings.currentPersonaId);
                        if (persona && persona.name) {
                            userName = persona.name;
                        }
                    }
                    
                    const processedGreeting = substituteParams(firstMessage.trim(), userName, characterName);
                    
                    // 스와이프 배열 준비
                    const swipes = Array.isArray(alternateGreetings) && alternateGreetings.length > 0 
                        ? alternateGreetings.filter(g => g && g.trim()).map(g => substituteParams(g.trim(), userName, characterName))
                        : [];
                    
                        // 실리태번 호환: 첫 번째 메시지(인덱스 0)는 채팅 생성 시간을 send_date로 사용
                        // 채팅 생성 시간을 send_date로 전달하여 첫 번째 메시지임을 보장
                        await this.addMessage(processedGreeting, 'assistant', characterName, characterAvatar, swipes, 0, null, this.chatCreateDate || Date.now());
                    
                    // 전송 버튼 상태 업데이트
                    this.updateSendButtonState();
                }
                }
            }
        } finally {
            // 로딩 완료 플래그 해제
            console.debug('[ChatManager.loadChat] finally 블록 실행 - _isLoadingChat 플래그 해제');
            this._isLoadingChat = false;
            console.debug('[ChatManager.loadChat] ✅ _isLoadingChat 플래그 해제 완료');
            
            // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 즉시 저장 불필요
            // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, 저장 시 특별 처리할 필요가 없습니다.
            // 기존 코드 (주석 처리):
            // if (this._isImportedChat && this.currentChatId && this.currentCharacterId) {
            //     console.debug('[ChatManager.loadChat] 불러온 채팅 감지, 즉시 저장하여 isImported 플래그 제거');
            //     this.saveChat().catch(error => {
            //         console.debug('[ChatManager.loadChat] 불러온 채팅 저장 중 오류 (무시):', error);
            //     });
            // }
            
            // 중요: this.chat 배열은 모든 메시지를 유지해야 함
            // DOM에는 messagesToLoad 설정에 따라 일부만 표시되지만, this.chat은 전체 메시지를 유지
            // saveChat에서 병합 로직이 있으므로, 여기서 DOM과 동기화할 필요 없음
            // 삭제된 메시지는 deleteMessage나 regenerateMessage에서 this.chat에서 제거됨
            
            // 채팅 목록 패널이 열려있으면 자동 새로고침 (현재 채팅 표시 업데이트, 즉시 실행)
            if (window.panelManager) {
                // requestAnimationFrame 제거하여 즉시 업데이트 (속도 개선)
                window.panelManager.refreshChatListPanel(this.currentCharacterId).catch(error => {
                    console.debug('[ChatManager.loadChat] 채팅 목록 패널 새로고침 오류:', error);
                });
            }
        }
    }

    /**
     * 새 채팅 생성
     * @param {string} characterId - 캐릭터 ID
     */
    async createNewChat(characterId) {
        // CharacterStorage - 전역 스코프에서 사용
        // humanizedDateTime - 전역 스코프에서 사용
        // substituteParams - 전역 스코프에서 사용
        
        const character = await CharacterStorage.load(characterId);
        if (!character) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20017', `캐릭터를 찾을 수 없음: ${characterId}`);
            }
            return;
        }

        // 캐릭터가 다른 경우 강제 초기화
        if (this.currentCharacterId && this.currentCharacterId !== characterId) {
            if (this.elements && this.elements.chatMessages) {
                this.elements.chatMessages.innerHTML = '';
                // DOM 업데이트 대기
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
        }

        const characterName = character?.data?.name || character?.name || 'Character';
        let chatName = `${characterName} - ${humanizedDateTime()}`;
        
        // ⚠️ 중요: 같은 제목(chatName)인 채팅이 있는지 확인하여 중복 방지
        // 같은 characterId이고 같은 chatName인 채팅이 있으면 제목에 숫자 추가
        // ChatStorage - 전역 스코프에서 사용
        const allChats = await ChatStorage.loadAll();
        
        // 같은 제목인 채팅 찾기 (같은 캐릭터의 채팅만 확인)
        const duplicateNameChats = Object.values(allChats)
            .filter(chat => {
                if (!chat || chat === null) return false;
                // 같은 캐릭터의 채팅만 확인
                const chatCharId = chat.characterId || chat.metadata?.characterId;
                if (chatCharId !== characterId) return false;
                // 같은 제목인지 확인
                return chat.chatName === chatName;
            });
        
        // 같은 제목인 채팅이 있으면 제목에 숫자 추가
        if (duplicateNameChats.length > 0) {
            const originalChatName = chatName; // 원본 제목 저장
            let counter = 2;
            let candidateName = `${originalChatName} (${counter})`;
            // allChats에서 직접 확인하여 더 안전하게 처리
            while (Object.values(allChats).some(chat => {
                if (!chat || chat === null) return false;
                const chatCharId = chat.characterId || chat.metadata?.characterId;
                return chatCharId === characterId && chat.chatName === candidateName;
            })) {
                counter++;
                candidateName = `${originalChatName} (${counter})`;
            }
            chatName = candidateName;
            console.log('[ChatManager.createNewChat] 같은 제목의 채팅 발견, 제목 수정:', {
                originalChatName: originalChatName,
                newChatName: candidateName,
                duplicateCount: duplicateNameChats.length
            });
        }
        
        // 채팅 초기화
        this.elements.chatMessages.innerHTML = '';
        
        // DOM 업데이트 대기 (초기화가 완전히 반영되도록)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // 현재 채팅 정보 설정
        this.currentCharacterId = characterId;
        this.currentChatName = chatName;
        this.currentChatId = null; // 새 채팅이므로 아직 저장되지 않음
        this.chatCreateDate = Date.now();
        
        // 실리태번과 동일: 새 채팅 생성 시 chat 배열 초기화
        this.chat = [];
        this.chat_metadata = {};
        
        // ⚠️ 중요: 새 채팅 생성 플래그 설정 (saveChat에서 UUID 매칭 건너뛰기용)
        this._isNewChatCreated = true;

        // 캐릭터에 현재 채팅 정보 저장
        character.chat = chatName;
        await CharacterStorage.save(characterId, character);

        // 그리팅 추가 전에 캐릭터 데이터를 다시 로드하여 최신 상태 보장 (특히 삭제 후 다시 불러온 경우)
        const latestCharacter = await CharacterStorage.load(characterId);
        if (!latestCharacter) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20018', `캐릭터 저장 후 재로드 실패: ${characterId}`);
            }
            return;
        }
        
        const firstMessage = latestCharacter?.data?.first_mes || latestCharacter?.first_mes || latestCharacter?.data?.first_message || '';
        // 캐릭터 아바타 가져오기 (여러 위치 확인) - loadChat과 동일한 로직 사용
        const characterAvatar = latestCharacter?.avatar_image || 
                               latestCharacter?.avatarImage || 
                               latestCharacter?.data?.avatar_image ||
                               latestCharacter?.data?.avatarImage ||
                               (latestCharacter?.avatar && latestCharacter.avatar !== 'none' ? latestCharacter.avatar : null) ||
                               null;
        const alternateGreetings = latestCharacter?.data?.alternate_greetings || latestCharacter?.alternate_greetings || [];
        
        if (firstMessage) {
            // {{user}}, {{char}} 매크로 치환
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            let userName = 'User';
            if (settings.currentPersonaId) {
                const persona = await UserPersonaStorage.load(settings.currentPersonaId);
                if (persona && persona.name) {
                    userName = persona.name;
                }
            }
            
            const processedGreeting = substituteParams(firstMessage.trim(), userName, characterName);
            
            // 스와이프 배열 준비
            const swipes = Array.isArray(alternateGreetings) && alternateGreetings.length > 0 
                ? alternateGreetings.filter(g => g && g.trim()).map(g => substituteParams(g.trim(), userName, characterName))
                : [];
            
            // 실리태번 호환: 첫 번째 메시지(인덱스 0)는 채팅 생성 시간을 send_date로 사용
            // 채팅 생성 시간을 send_date로 전달하여 첫 번째 메시지임을 보장
            // send_date가 가장 작으면 정렬 시 인덱스 0에 위치하게 됨
            await this.addMessage(processedGreeting, 'assistant', characterName, characterAvatar, swipes, 0, null, this.chatCreateDate || Date.now());
            
            // 새 채팅 생성 직후 그리팅 추가 시 즉시 저장하여 채팅 목록에 바로 표시되도록 함
            // 디바운스를 사용하지 않고 즉시 저장 (새 채팅은 목록에 빠르게 나타나야 함)
            await this.saveChat();
        } else {
            // 그리팅이 없어도 채팅은 저장되어야 함 (규칙 4: 0개 메시지 채팅도 채팅으로 인정)
            // 그리팅이 없는 경우 즉시 0개 메시지 채팅으로 저장
            await this.saveChat();
        }

        // 전송 버튼 상태 업데이트 (그리팅 추가 후 또는 0개 메시지 채팅 저장 후)
        this.updateSendButtonState();

        // 스크롤을 맨 아래로 (새 채팅 생성 시)
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.scrollToBottom();
            }, 100);
        });
        
        // 인풋창 높이 리셋 (새 채팅 생성 시 인풋창이 비어있을 수 있으므로)
        if (this.elements && this.elements.messageInput) {
            const inputValue = this.elements.messageInput.value.trim();
            if (!inputValue) {
                // 인풋창이 비어있으면 높이 리셋
                this.elements.messageInput.style.height = '44px';
                this.elements.messageInput.offsetHeight;
            }
        }

        // 채팅 목록 패널이 열려있으면 새 채팅 목록에 반영 (saveChat 완료 후)
        // saveChat이 완료되어 currentChatId가 설정된 후에 호출해야 함
        if (window.panelManager) {
            window.panelManager.refreshChatListPanel(characterId).catch(error => {
                console.debug('[ChatManager.createNewChat] 채팅 목록 패널 새로고침 오류:', error);
            });
        }
    }

    /**
     * 채팅 로드 또는 생성
     * 캐릭터 선택 시 마지막 채팅 로드 또는 새 채팅 생성
     * 
     * ⚠️ 중요: 이 함수는 다음 기능들과 강하게 연동되어 있습니다.
     * 
     * [연동 기능]
     * 1. character.chat: 저장된 채팅 이름을 우선 찾음 (importChat에서 업데이트됨)
     * 2. imported_date 정렬: 불러온 채팅은 imported_date를 lastMessageDate로 사용하여 최신순 정렬
     *    * 불러온 채팅: lastMessageDate = imported_date (최신순 정렬)
     *    * 일반 채팅: lastMessageDate = 마지막 메시지의 send_date
     * 3. loadChat: 찾은 채팅을 loadChat으로 로드 (messagesToLoad, 더보기 버튼 적용)
     * 4. createNewChat: 채팅이 없으면 새 채팅 생성
     * 
     * [수정 시 주의사항]
     * - 정렬 로직 변경 시 → importChat의 imported_date 설정과 일치해야 함
     * - character.chat 찾기 로직 변경 시 → importChat에서 character.chat 업데이트 확인
     * - 채팅이 없을 때 새 채팅 생성 조건 변경 시 → saveChat에서 새 채팅 생성 방지 로직 확인
     *   * saveChat에서 currentChatId 없고 DOM 메시지 1개 이하면 저장 건너뜀
     * 
     * @param {string} characterId - 캐릭터 ID
     */
    async loadOrCreateChat(characterId) {
        
        // CharacterStorage, ChatStorage - 전역 스코프에서 사용
        const character = await CharacterStorage.load(characterId);
        
        if (!character) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20017', `캐릭터를 찾을 수 없음: ${characterId}`);
            }
            return;
        }

        // 캐릭터가 변경된 경우 기존 채팅 저장 후 초기화
        if (this.currentCharacterId && this.currentCharacterId !== characterId) {
            // 기존 채팅 저장 (다른 캐릭터로 전환 전)
            if (this.currentChatId && this.elements.chatMessages.children.length > 0) {
                try {
                    await this.saveChat();
                } catch (error) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_CHAT_3011', '이전 채팅 저장 중 오류가 발생했습니다', error);
                    }
                }
            }
            
            if (this.elements && this.elements.chatMessages) {
                this.elements.chatMessages.innerHTML = '';
                // DOM 업데이트 대기 (한 번만, 속도 개선)
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
            // 현재 채팅 상태 초기화
            this.currentChatId = null;
            this.currentChatName = null;
            this.currentCharacterId = null;
            this.chatCreateDate = null;
        }

        // 캐릭터의 모든 채팅 찾기 (가장 최근 메시지가 추가된 채팅)
        const allChats = await ChatStorage.loadAll();
        const characterName = character?.data?.name || character?.name || 'Unknown';
        
        
        // 해당 캐릭터의 모든 채팅 필터링
        // 중요: 여러 경로로 확인하여 저장 과정에서 일부 필드가 누락된 경우에도 찾을 수 있도록 함
        const characterChats = Object.entries(allChats)
            .filter(([chatId, chatData]) => {
                // 1. characterId로 확인 (가장 정확)
                if (chatData.characterId === characterId) {
                    return true;
                }
                
                // 2. metadata.characterId로 확인 (이중 저장된 경우)
                if (chatData.metadata?.characterId === characterId) {
                    return true;
                }
                
                // 3. chatId에서 characterId 추출 시도 (형식: characterId_chatName)
                // 정확한 매칭: characterId_ 로 시작하는 경우만
                if (chatId.startsWith(characterId + '_')) {
                    return true;
                }
                
                // 4. characterName으로 확인 (fallback)
                // characterId가 없지만 이름이 일치하는 경우
                const matchesName = chatData.character_name === characterName || 
                                   chatData.metadata?.character_name === characterName;
                if (matchesName) {
                    // 이름만으로는 다른 캐릭터와 혼동될 수 있으므로,
                    // 충돌하는 ID가 없어야 함
                    const hasConflictingId = chatData.characterId && chatData.characterId !== characterId;
                    const hasConflictingMetadataId = chatData.metadata?.characterId && 
                                                     chatData.metadata?.characterId !== characterId;
                    // 충돌하는 ID가 없으면 이름 매칭 허용
                    if (!hasConflictingId && !hasConflictingMetadataId) {
                        // 추가 검증: chatId에도 characterId가 포함되어 있으면 더 확실함
                        if (chatId.includes(characterId)) {
                            return true;
                        }
                        // chatId에 characterId가 없어도 충돌하는 ID가 없으면 허용
                        return true;
                    }
                }
                
                return false;
            })
            .map(([chatId, chatData]) => {
                // 실리태번 호환: 첫 번째 메시지는 인덱스 0에 있음
                // messages 배열이 유효한 배열인지 확인
                const messages = chatData.messages;
                const messageCount = Array.isArray(messages) ? messages.length : 0;
                // 규칙 4: 메시지가 0개인 채팅도 채팅으로 인정
                // 실리태번 호환: 인덱스 0에 첫 번째 메시지가 있을 수 있으므로 길이 1도 유효함
                const hasMessages = messageCount > 0;
                
                // lastMessageDate 계산: 메시지가 있으면 마지막 메시지 날짜, 없으면 생성 날짜 사용
                // 불러오기한 채팅은 imported_date를 우선 사용 (최근 불러온 채팅으로 표시)
                let lastMessageDate = 0;
                
                // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 imported_date 체크 불필요
                // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으므로, imported_date를 체크할 필요가 없습니다.
                // 기존 코드 (주석 처리):
                // if (chatData.metadata?.isImported && chatData.metadata?.imported_date) {
                //     lastMessageDate = chatData.metadata.imported_date;
                // } else if (chatData.lastMessageDate) {
                // 실리태번 방식: lastMessageDate를 그대로 사용
                if (chatData.lastMessageDate) {
                        lastMessageDate = chatData.lastMessageDate;
                } else if (hasMessages) {
                    // lastMessageDate가 없으면 메시지 배열의 마지막 메시지 타임스탬프 사용
                    if (chatData.messages && chatData.messages.length > 0) {
                        // 마지막 메시지의 타임스탬프 사용 (실리태번 형식: send_date 우선)
                        // send_date 기준으로 정렬된 배열에서 마지막 메시지 찾기
                        const sortedMessages = [...chatData.messages].sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                        const lastMessage = sortedMessages[sortedMessages.length - 1];
                        // send_date가 없으면 chatData.metadata?.create_date를 먼저 시도 (Date.now()보다 나음)
                        lastMessageDate = lastMessage.send_date || // 실리태번 형식
                                         lastMessage.date || 
                                         lastMessage.timestamp || 
                                         chatData.metadata?.create_date || 
                                         chatData.create_date ||
                                         (chatData.metadata?.chat_metadata?.create_date) ||
                                         Date.now(); // fallback으로 현재 시간 사용 (0보다는 나음)
                    }
                } else {
                    // 규칙 4: 메시지가 0개인 채팅도 채팅으로 인정하므로, 생성 날짜를 사용
                    // create_date가 없으면 채팅 ID에서 타임스탬프 추출 시도 또는 현재 시간 사용
                    lastMessageDate = chatData.metadata?.create_date || 
                                     chatData.create_date || 
                                     (chatData.metadata?.chat_metadata?.create_date) ||
                                     Date.now(); // 날짜가 없어도 채팅으로 인정 (fallback으로 현재 시간)
                }
                
                return {
                    chatId,
                    chatData,
                    lastMessageDate,
                    messageCount,
                    hasMessages
                };
            })
            // 규칙 4: 0개 메시지 채팅도 채팅으로 인정하므로, lastMessageDate 필터 제거
            // .filter(item => item.lastMessageDate > 0) 제거 - 모든 채팅 포함
            .sort((a, b) => b.lastMessageDate - a.lastMessageDate); // 최신순 정렬
        
        // 디버그: 캐릭터 채팅 목록 확인
        console.debug('[ChatManager.loadOrCreateChat] Character chats found:', {
            characterId,
            characterName,
            totalChats: Object.keys(allChats).length,
            characterChatsCount: characterChats.length,
            characterChats: characterChats.map(c => ({
                chatId: c.chatId,
                chatName: c.chatData.chatName,
                messageCount: c.messageCount,
                lastMessageDate: c.lastMessageDate,
                hasMessages: c.hasMessages
            }))
        });


        // 저장된 채팅 이름이 있으면 우선 찾기 (실리태번 방식)
        // 단, character.chat이 실제로 존재하는 채팅인지 확인 (삭제된 채팅을 가리킬 수 있음)
        let chatToLoad = null;
        if (character.chat) {
            // 1. 정확한 이름 매칭 시도
            chatToLoad = characterChats.find(c => c.chatData.chatName === character.chat);
            
            // 2. 이름이 정확히 일치하지 않으면 문자열 변환 후 비교
            if (!chatToLoad) {
                chatToLoad = characterChats.find(c => String(c.chatData.chatName) === String(character.chat));
            }
            
            // 3. chatId에서도 찾기 시도 (형식: characterId_chatName 또는 characterId_chatName_timestamp)
            if (!chatToLoad && character.chat) {
                // 타임스탬프가 포함된 경우도 고려
                chatToLoad = characterChats.find(c => {
                    // 정확한 chatId 매칭
                const expectedChatId = `${characterId}_${character.chat}`;
                    if (c.chatId === expectedChatId) return true;
                    
                    // 타임스탬프가 포함된 경우 (characterId_chatName_timestamp)
                    const chatIdPrefix = `${characterId}_${character.chat}_`;
                    if (c.chatId.startsWith(chatIdPrefix)) return true;
                    
                    return false;
                });
            }
            
            // 4. chatId의 chatName 부분만 추출하여 비교 시도
            // characterId_chatName 형식에서 chatName 부분만 비교
            if (!chatToLoad && character.chat) {
                chatToLoad = characterChats.find(c => {
                    const chatIdParts = c.chatId.split('_');
                    if (chatIdParts.length > 1) {
                        // characterId 이후의 모든 부분을 합쳐서 비교
                        // 타임스탬프가 포함되어 있으면 제외
                        let chatNameFromId = chatIdParts.slice(1).join('_');
                        // 타임스탬프 제거 시도 (숫자만으로 된 마지막 부분)
                        const timestampMatch = chatNameFromId.match(/^(.*)_(\d{13,})$/);
                        if (timestampMatch) {
                            chatNameFromId = timestampMatch[1];
                        }
                        return chatNameFromId === character.chat || chatNameFromId === String(character.chat);
                    }
                    return false;
                });
            }
            
            // character.chat이 실제로 존재하는 채팅을 가리키지 않는 경우 (삭제된 채팅)
            // character.chat 필드를 초기화하여 다음에 새 채팅을 만들 수 있도록 함
            if (!chatToLoad) {
                // character.chat 이름과 일치하지 않지만, 채팅이 존재하면 가장 최근 채팅 사용
                // 중요: character.chat이 잘못 저장되었을 수 있으므로, 채팅이 있으면 그것을 사용
                // 1개 메시지만 있는 채팅도 유효한 채팅이므로 포함
                if (characterChats.length > 0) {
                    chatToLoad = characterChats[0];
                    console.debug('[ChatManager.loadOrCreateChat] 저장된 채팅 이름 불일치, 최근 채팅 사용:', {
                        savedChatName: character.chat,
                        foundChatId: chatToLoad.chatId,
                        foundChatName: chatToLoad.chatData.chatName,
                        messageCount: chatToLoad.messageCount
                    });
                    // character.chat 업데이트 (실제 채팅 이름과 동기화)
                    character.chat = chatToLoad.chatData.chatName;
                    try {
                        await CharacterStorage.save(characterId, character);
                    } catch (e) {
                        console.debug('[ChatManager.loadOrCreateChat] Character.chat 업데이트 실패 (계속 진행):', e);
                    }
                } else {
                    // 채팅이 하나도 없는 경우: character.chat 필드를 초기화 (삭제된 채팅을 가리키고 있을 수 있음)
                    console.debug('[ChatManager.loadOrCreateChat] Saved chat not found and no chats exist (will create new chat)');
                    character.chat = null;
                    try {
                        await CharacterStorage.save(characterId, character);
                    } catch (e) {
                        console.debug('[ChatManager.loadOrCreateChat] Character.chat 초기화 실패 (계속 진행):', e);
                    }
                }
            } else {
                console.debug('[ChatManager.loadOrCreateChat] Found saved chat:', {
                    chatId: chatToLoad.chatId,
                    chatName: chatToLoad.chatData.chatName,
                    messageCount: chatToLoad.messageCount
                });
            }
        } else {
            // character.chat이 없는 경우: 가장 최근 채팅 사용 (1개 메시지만 있는 채팅도 포함)
            if (characterChats.length > 0) {
                chatToLoad = characterChats[0];
                console.debug('[ChatManager.loadOrCreateChat] No saved chat name, using most recent chat:', {
                    chatId: chatToLoad.chatId,
                    chatName: chatToLoad.chatData.chatName,
                    messageCount: chatToLoad.messageCount,
                    lastMessageDate: chatToLoad.lastMessageDate,
                    hasMessages: chatToLoad.hasMessages
                });
            }
        }
        
        // chatToLoad가 아직 없고, 채팅이 하나도 없는 경우 디버그 정보 출력
        if (!chatToLoad && characterChats.length === 0) {
            // 디버그: 필터링 결과 상세 확인
            // 모든 채팅을 다시 확인하여 왜 필터링되지 않았는지 확인
            const allChatsArray = Object.entries(allChats);
            const potentialMatches = allChatsArray
                .filter(([chatId, chatData]) => {
                    // characterId로 확인
                    const matchesById = chatData.characterId === characterId;
                    // characterName으로 확인
                    const matchesByName = chatData.character_name === characterName || 
                                        chatData.metadata?.character_name === characterName;
                    // chatId에 characterId 포함 확인 (정확한 시작만)
                    const matchesByChatId = chatId.startsWith(characterId + '_');
                    // metadata.characterId 확인
                    const matchesByMetadataId = chatData.metadata?.characterId === characterId;
                    
                    return matchesById || matchesByName || matchesByChatId || matchesByMetadataId;
                })
                .map(([chatId, chatData]) => ({
                    chatId,
                    chatName: chatData.chatName,
                    messageCount: chatData.messages?.length || 0,
                    characterId: chatData.characterId,
                    metadataCharacterId: chatData.metadata?.characterId,
                    characterName: chatData.character_name || chatData.metadata?.character_name,
                    hasMessages: (chatData.messages?.length || 0) > 0
                }));
            
            const debugInfo = {
                timestamp: new Date().toISOString(),
                characterId,
                characterName,
                totalChatsInStorage: Object.keys(allChats).length,
                characterChatsCount: characterChats.length,
                potentialMatchesFound: potentialMatches.length,
                potentialMatches: potentialMatches,
                // 필터링되지 않은 채팅들도 보여줌
                filteredOutChatsWithMessages: allChatsArray
                    .filter(([chatId, chatData]) => {
                        // 필터링된 채팅이 아닌 것들 중 메시지가 있는 것
                        const isNotMatch = !potentialMatches.some(m => m.chatId === chatId);
                        const hasMessages = (chatData.messages?.length || 0) > 0;
                        return isNotMatch && hasMessages;
                    })
                    .slice(0, 5) // 최대 5개만 보여줌
                    .map(([chatId, chatData]) => ({
                        chatId,
                        chatName: chatData.chatName,
                        messageCount: chatData.messages?.length || 0,
                        characterId: chatData.characterId,
                        metadataCharacterId: chatData.metadata?.characterId,
                        characterName: chatData.character_name || chatData.metadata?.character_name
                    }))
            };
            
            // 디버깅 정보는 콘솔에만 기록 (토스트 제거 - 정상적인 경우)
            console.debug('[ChatManager] 캐릭터에 채팅이 없어 새 채팅 생성', debugInfo);
            // localStorage에 저장하여 새로고침 후에도 확인 가능
            try {
                const existingDebug = JSON.parse(localStorage.getItem('chatLoadDebug') || '[]');
                existingDebug.push({ type: 'noChatsFound', ...debugInfo });
                // 최대 20개만 유지
                if (existingDebug.length > 20) existingDebug.shift();
                localStorage.setItem('chatLoadDebug', JSON.stringify(existingDebug));
                // 디버깅 정보 저장 완료는 콘솔에만 기록
                console.debug('[ChatManager] 채팅을 찾지 못함, 디버깅 정보 저장됨');
            } catch (e) {
                // 실제 오류만 토스트 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_CHAT_3014', '디버깅 정보 저장 실패', e);
                }
            }
        }

        // chatToLoad가 여전히 없지만 채팅이 존재하는 경우, 가장 최근 채팅 사용
        // 이는 character.chat 블록 밖에서도 적용되어야 하는 안전장치
        if (!chatToLoad && characterChats.length > 0) {
            chatToLoad = characterChats[0];
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20021', 'chatToLoad가 null이지만 채팅 존재, 최근 채팅 사용');
            }
            // character.chat 업데이트 (실제 채팅 이름과 동기화)
            character.chat = chatToLoad.chatData.chatName;
            try {
                await CharacterStorage.save(characterId, character);
            } catch (e) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_CHAT_3012', 'Character.chat 업데이트 실패', e);
                }
            }
        }
        
        // 추가 안전장치: characterChats가 비어있거나 chatToLoad가 null인 경우
        // 필터링 조건을 더 완화하여 메시지가 있는 채팅을 찾음
        // characterChats.length === 0이거나, chatToLoad가 null이면서 characterChats.length > 0인 경우 모두 처리
        if (!chatToLoad) {
            // 모든 채팅을 다시 확인하여 메시지가 있는 채팅 찾기
            // 중요: characterChats 필터링에서 놓친 채팅을 찾기 위해 필터링 조건을 더 완화
            const allChatsArray = Object.entries(allChats);
            const chatsWithMessages = allChatsArray
                .filter(([chatId, chatData]) => {
                    // 실리태번 호환: 첫 번째 메시지는 인덱스 0에 있음
                    // messages 배열이 유효하고 길이가 1 이상이어야 메시지가 있음
                    const messages = chatData.messages;
                    const messageCount = Array.isArray(messages) ? messages.length : 0;
                    // 메시지가 1개 이상 있는 채팅만 확인 (0개 메시지는 제외)
                    // 실리태번 호환: 인덱스 0에 첫 번째 메시지가 있을 수 있으므로 길이 1도 유효함
                    if (messageCount === 0) return false;
                    
                    // 필터링 조건을 더 완화: characterId가 없어도 chatId에 포함되어 있으면 허용
                    const matchesById = chatData.characterId === characterId;
                    const matchesByMetadataId = chatData.metadata?.characterId === characterId;
                    // chatId에서 characterId 부분 추출 시도 (더 유연하게)
                    const chatIdParts = chatId.split('_');
                    const matchesByChatId = chatId.startsWith(characterId + '_') || 
                                          chatId.includes(characterId) ||
                                          (chatIdParts.length > 1 && chatIdParts[0] === characterId);
                    
                    // 이름 매칭도 더 완화: characterId가 없거나 일치하면 이름으로도 매칭 허용
                    const matchesByName = (chatData.character_name === characterName || 
                                         chatData.metadata?.character_name === characterName) &&
                                        (!chatData.characterId || chatData.characterId === characterId) &&
                                        (!chatData.metadata?.characterId || chatData.metadata?.characterId === characterId);
                    
                    // 추가: chatId에 characterName이 포함되어 있는지도 확인 (더 유연한 매칭)
                    const matchesByChatIdName = chatId.includes(characterName) && 
                                              (!chatData.characterId || chatData.characterId === characterId);
                    
                    return matchesById || matchesByMetadataId || matchesByChatId || matchesByName || matchesByChatIdName;
                })
                .map(([chatId, chatData]) => {
                    const messageCount = chatData.messages?.length || 0;
                    let lastMessageDate = 0;
                    
                    if (chatData.messages && chatData.messages.length > 0) {
                        const sortedMessages = [...chatData.messages].sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
                        const lastMessage = sortedMessages[sortedMessages.length - 1];
                        lastMessageDate = lastMessage.send_date || 
                                         lastMessage.date || 
                                         lastMessage.timestamp || 
                                         chatData.metadata?.create_date || 
                                         chatData.create_date ||
                                         (chatData.metadata?.chat_metadata?.create_date) ||
                                         Date.now();
                    }
                    
                    return {
                        chatId,
                        chatData,
                        lastMessageDate,
                        messageCount,
                        hasMessages: true
                    };
                })
                .sort((a, b) => b.lastMessageDate - a.lastMessageDate); // 최신순 정렬
            
            // 메시지가 있는 채팅을 찾았으면 사용
            if (chatsWithMessages.length > 0) {
                chatToLoad = chatsWithMessages[0];
                // character.chat 업데이트
                character.chat = chatToLoad.chatData.chatName;
                try {
                    await CharacterStorage.save(characterId, character);
                } catch (e) {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_CHAT_3012', 'Character.chat 업데이트 실패', e);
                    }
                }
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20031', '필터링에서 제외된 메시지가 있는 채팅 발견, 사용');
                }
            }
        }

        // 채팅 로드
        if (chatToLoad) {
            // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
            // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으며, chat.length === 0 조건만으로 그리팅 추가 여부를 결정합니다.
            // 기존 코드 (주석 처리):
            // const isImported = chatToLoad.chatData.metadata?.isImported === true;
            // const isEmptyChat = isImported ? false : (chatToLoad.messageCount === 0);
            // 실리태번 방식: messageCount만 확인
            const isEmptyChat = chatToLoad.messageCount === 0;
            
            await this.loadChat(chatToLoad.chatId, isEmptyChat);
            
            // ⚠️ 중요: loadChat 후에 this.currentCharacterId 설정
            // loadChat에서는 this.currentCharacterId를 설정하지 않으므로 여기서 설정
            this.currentCharacterId = characterId;
            
            // 캐릭터의 현재 채팅 정보 업데이트 (character.chat)
            character.chat = chatToLoad.chatData.chatName;
            await CharacterStorage.save(characterId, character);
            
            
            return;
        }

        // 채팅이 없으면 새로 생성 (규칙 2: 채팅 목록이 0개면 무조건 새 채팅 생성)
        // chatToLoad가 null이고 characterChats.length === 0인 경우에만 실행
        if (characterChats.length > 0) {
            // 이 경우는 발생하면 안 됨 (위의 안전장치에서 처리되어야 함)
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3015', '내부 오류: chatToLoad가 null이지만 채팅이 존재함');
            }
            // 안전장치: 가장 최근 채팅 강제 사용
            chatToLoad = characterChats[0];
            character.chat = chatToLoad.chatData.chatName;
            await CharacterStorage.save(characterId, character);
            // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
            // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으며, chat.length === 0 조건만으로 그리팅 추가 여부를 결정합니다.
            // 기존 코드 (주석 처리):
            // const isImported = chatToLoad.chatData.metadata?.isImported === true;
            // const isEmptyChat = isImported ? false : (chatToLoad.messageCount === 0);
            // 실리태번 방식: messageCount만 확인
            const isEmptyChat = chatToLoad.messageCount === 0;
            await this.loadChat(chatToLoad.chatId, isEmptyChat);
            
            // ⚠️ 중요: loadChat 후에 this.currentCharacterId 설정
            // loadChat에서는 this.currentCharacterId를 설정하지 않으므로 여기서 설정
            this.currentCharacterId = characterId;
            
            return;
        }

        // 실제로 채팅이 하나도 없는 경우에만 새 채팅 생성
        const debugInfo = {
            type: 'creatingNewChat',
            timestamp: new Date().toISOString(),
            characterId,
            characterName,
            reason: 'noChatsFound',
            characterChatsCount: 0,
            characterChat: character.chat || '(none)'
        };
        // 디버깅 정보는 콘솔에만 기록 (토스트 제거 - 정상적인 경우)
        console.debug('[ChatManager] 새 채팅 생성 (채팅이 없음)', debugInfo);
        try {
            const existingDebug = JSON.parse(localStorage.getItem('chatLoadDebug') || '[]');
            existingDebug.push(debugInfo);
            // 최대 20개만 유지
            if (existingDebug.length > 20) existingDebug.shift();
            localStorage.setItem('chatLoadDebug', JSON.stringify(existingDebug));
            // 디버깅 정보 저장 완료는 콘솔에만 기록
            console.debug('[ChatManager] 새 채팅 생성됨, 디버깅 정보 저장됨');
        } catch (e) {
            // 실제 오류만 토스트 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3014', '디버깅 정보 저장 실패', e);
            }
        }
        
        await this.createNewChat(characterId);
    }

    /**
     * 스크롤을 맨 아래로
     * @param {boolean} force - 강제 스크롤 (즉시 실행, 추가 확인 없음)
     */
    scrollToBottom(force = false) {
        // chat-messages가 실제 스크롤 컨테이너 (CSS에서 overflow-y: auto 설정됨)
        const messages = document.getElementById('chat-messages');
        if (!messages) return;
        
        const scrollHeight = messages.scrollHeight;
        const clientHeight = messages.clientHeight;
        
        // 스크롤이 가능한 경우에만 스크롤
        if (scrollHeight > clientHeight) {
            // 즉시 스크롤
            messages.scrollTop = scrollHeight;
            
            // 강제 모드가 아니면 추가 확인
            if (!force) {
                // DOM 업데이트 후 다시 확인하여 정확히 최하단에 위치하도록
                requestAnimationFrame(() => {
                    const newScrollHeight = messages.scrollHeight;
                    const newClientHeight = messages.clientHeight;
                    if (newScrollHeight > newClientHeight) {
                        const currentScrollTop = messages.scrollTop;
                        const maxScrollTop = newScrollHeight - newClientHeight;
                        const distanceFromBottom = maxScrollTop - currentScrollTop;
                        
                        // 10px 이상 차이나면 다시 스크롤
                        if (distanceFromBottom > 10) {
                            messages.scrollTop = newScrollHeight;
                        }
                    }
                });
            }
        }
    }
    
    /**
     * 스크롤을 최하단으로 안정적으로 이동 (여러 번 시도)
     * @param {number} maxAttempts - 최대 시도 횟수
     * @param {number} delay - 각 시도 간 지연 시간 (ms)
     */
    async scrollToBottomSmooth(maxAttempts = 5, delay = 100) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;
        
        let lastScrollHeight = 0;
        let stableCount = 0;
        const requiredStableCount = 2; // scrollHeight가 2번 연속 같아야 안정화된 것으로 간주
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // 현재 스크롤 높이 확인
            const currentScrollHeight = messages.scrollHeight;
            const scrollTop = messages.scrollTop;
            const clientHeight = messages.clientHeight;
            const maxScrollTop = currentScrollHeight - clientHeight;
            
            // 스크롤 높이가 안정화되었는지 확인
            if (currentScrollHeight === lastScrollHeight) {
                stableCount++;
                if (stableCount >= requiredStableCount) {
                    // 안정화되었고 최하단에 도달했는지 확인
                    const distanceFromBottom = maxScrollTop - scrollTop;
                    if (distanceFromBottom <= 10) {
                        // 이미 최하단에 있으면 종료
                        break;
                    }
                }
            } else {
                stableCount = 0;
            }
            
            lastScrollHeight = currentScrollHeight;
            
            // 스크롤 실행
            messages.scrollTop = currentScrollHeight;
            
            // 다음 시도 전 대기 (마지막 시도가 아니면)
            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // 이미지 로딩 완료 후에도 한 번 더 확인 (이미지로 인해 높이가 변경될 수 있음)
        const images = messages.querySelectorAll('img');
        if (images.length > 0) {
            // 이미지 로딩 완료 대기 (최대 2초)
            const imageLoadPromises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    const timeout = setTimeout(resolve, 2000);
                    img.addEventListener('load', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                    img.addEventListener('error', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                });
            });
            
            await Promise.all(imageLoadPromises);
            
            // 이미지 로딩 후 스크롤 높이가 변경되었을 수 있으므로 다시 스크롤
            const finalScrollHeight = messages.scrollHeight;
            const finalScrollTop = messages.scrollTop;
            const finalClientHeight = messages.clientHeight;
            const finalMaxScrollTop = finalScrollHeight - finalClientHeight;
            const finalDistanceFromBottom = finalMaxScrollTop - finalScrollTop;
            
            if (finalDistanceFromBottom > 10) {
                messages.scrollTop = finalScrollHeight;
            }
        }
    }
    
    /**
     * 채팅 진입 시 최하단으로 스크롤을 확실히 고정 (백그라운드에서 비동기 실행)
     * 블로킹하지 않고 백그라운드에서 실행하여 성능 저하 방지
     */
    ensureScrollToBottomBackground() {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;
        
        let checkCount = 0;
        const maxChecks = 10; // 1초간만 (100ms 간격)
        let isCleanedUp = false;
        let lastScrollTop = messages.scrollTop;
        let scrollLock = false; // 사용자가 스크롤을 올렸는지 감지
        
        // 스크롤 이벤트 리스너: 사용자가 스크롤을 올렸는지 감지
        const scrollHandler = () => {
            if (isCleanedUp) return;
            
            const currentScrollTop = messages.scrollTop;
            const scrollHeight = messages.scrollHeight;
            const clientHeight = messages.clientHeight;
            const maxScrollTop = scrollHeight - clientHeight;
            const distanceFromBottom = maxScrollTop - currentScrollTop;
            
            // 사용자가 스크롤을 위로 올렸는지 확인 (이전 스크롤 위치보다 위로)
            if (currentScrollTop < lastScrollTop - 5) {
                // 사용자가 스크롤을 올렸으면 자동 스크롤 중단
                scrollLock = true;
            }
            
            // 사용자가 최하단으로 스크롤하면 자동 스크롤 재개
            if (distanceFromBottom <= 5) {
                scrollLock = false;
            }
            
            lastScrollTop = currentScrollTop;
        };
        
        messages.addEventListener('scroll', scrollHandler, { passive: true });
        
        const performScroll = () => {
            if (!messages || isCleanedUp || scrollLock) return;
            
            const scrollHeight = messages.scrollHeight;
            const clientHeight = messages.clientHeight;
            
            // 스크롤이 가능한 경우에만 스크롤
            if (scrollHeight > clientHeight) {
                const scrollTop = messages.scrollTop;
                const maxScrollTop = scrollHeight - clientHeight;
                const distanceFromBottom = maxScrollTop - scrollTop;
                
                // 최하단이 아니면 스크롤 (1px 이상 차이나면)
                if (distanceFromBottom > 1) {
                    messages.scrollTop = scrollHeight;
                    lastScrollTop = messages.scrollTop;
                }
            }
        };
        
        // ResizeObserver: 높이 변경 감지 (간단한 디바운싱)
        let resizeTimeout = null;
        const resizeObserver = new ResizeObserver(() => {
            if (isCleanedUp) return;
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                performScroll();
            }, 50);
        });
        resizeObserver.observe(messages);
        
        // 이미지 로딩 감지
        const images = messages.querySelectorAll('img');
        images.forEach(img => {
            if (img.complete) return;
            img.addEventListener('load', () => {
                if (!isCleanedUp) {
                    setTimeout(() => performScroll(), 100);
                }
            }, { once: true });
            img.addEventListener('error', () => {
                if (!isCleanedUp) {
                    setTimeout(() => performScroll(), 100);
                }
            }, { once: true });
        });
        
        // 정기적으로 스크롤 확인 (1초간만)
        const checkInterval = setInterval(() => {
            if (isCleanedUp) {
                clearInterval(checkInterval);
                return;
            }
            
            checkCount++;
            performScroll();
            
            // 1초 후 정리
            if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                cleanup();
            }
        }, 100);
        
        // 정리 함수
        const cleanup = () => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            
            if (resizeTimeout) clearTimeout(resizeTimeout);
            if (checkInterval) clearInterval(checkInterval);
            resizeObserver.disconnect();
            messages.removeEventListener('scroll', scrollHandler);
        };
        
        // 1.5초 후 자동 정리 (안전장치)
        setTimeout(() => {
            cleanup();
        }, 1500);
    }

    /**
     * 채팅 초기화
     * 주의: 기존 채팅은 저장하지 않고 새 채팅을 시작합니다.
     * 기존 채팅을 저장하려면 clearChat 전에 saveChat()을 호출해야 합니다.
     */
    async clearChat() {
        // 디바운스된 저장 취소 (중복 저장 방지)
        if (this.saveChatDebounceTimer) {
            clearTimeout(this.saveChatDebounceTimer);
            this.saveChatDebounceTimer = null;
        }
        
        // 현재 채팅 ID 초기화 (새 채팅 시작)
        
        this.currentChatId = null;
        this.currentChatName = null;
        this.chatCreateDate = Date.now(); // 새 채팅 생성 날짜
        
        this.elements.chatMessages.innerHTML = '';
        
        // DOM 업데이트 대기
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // 현재 캐릭터가 있으면 그리팅 추가
        if (this.currentCharacterId) {
            // CharacterStorage, SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            // substituteParams - 전역 스코프에서 사용
            
            const character = await CharacterStorage.load(this.currentCharacterId);
            if (character) {
                const characterName = character?.data?.name || character?.name || 'Character';
                const characterAvatar = character?.avatar_image || character?.avatarImage || character?.data?.avatar_image || '';
                const firstMessage = character?.data?.first_mes || character?.first_mes || character?.data?.first_message || '';
                const alternateGreetings = character?.data?.alternate_greetings || character?.alternate_greetings || [];
                
                if (firstMessage) {
                    // {{user}}, {{char}} 매크로 치환
                    const settings = await SettingsStorage.load();
                    let userName = 'User';
                    if (settings.currentPersonaId) {
                        const persona = await UserPersonaStorage.load(settings.currentPersonaId);
                        if (persona && persona.name) {
                            userName = persona.name;
                        }
                    }
                    
                    const processedGreeting = substituteParams(firstMessage.trim(), userName, characterName);
                    
                    // 스와이프 배열 준비
                    const swipes = Array.isArray(alternateGreetings) && alternateGreetings.length > 0 
                        ? alternateGreetings.filter(g => g && g.trim()).map(g => substituteParams(g.trim(), userName, characterName))
                        : [];
                    
                    // 실리태번 호환: 첫 번째 메시지(인덱스 0)는 채팅 생성 시간을 send_date로 사용
                    // 채팅 생성 시간을 send_date로 전달하여 첫 번째 메시지임을 보장
                    await this.addMessage(processedGreeting, 'assistant', characterName, characterAvatar, swipes, 0, null, this.chatCreateDate || Date.now());
                    // 전송 버튼 상태 업데이트 (그리팅 추가 후)
                    this.updateSendButtonState();
                }
            }
        } else {
            // 캐릭터가 없으면 환영 메시지 표시
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'welcome-message';
            welcomeMsg.innerHTML = '<p>캐릭터를 선택하고 채팅을 시작하세요.</p>';
            this.elements.chatMessages.appendChild(welcomeMsg);
        }
    }

    /**
     * 스와이프 제스처 설정 (터치 이벤트)
     * @param {HTMLElement} wrapper - 메시지 래퍼 요소
     * @param {HTMLElement} messageDiv - 메시지 요소
     * 
     * 참고: 모바일에서 메시지를 옆으로 스와이프하는 동작을 비활성화함
     * (사용자 요청: 스와이프가 넘어가지 않도록)
     */
    setupSwipeGestures(wrapper, messageDiv) {
        // 스와이프 제스처 비활성화 (모바일에서 메시지 스와이프 방지)
        return;
        
        // 아래 코드는 사용하지 않음 (주석 처리)
        /*
        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;
        const SWIPE_THRESHOLD = 50; // 스와이프 감지 최소 거리
        
        // 터치 시작
        const handleTouchStart = (e) => {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            isSwiping = false;
        };
        
        // 터치 이동
        const handleTouchMove = (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            
            // 세로 스크롤인지 확인 (세로 스크롤이 더 크면 무시)
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                return;
            }
            
            // 가로 스와이프 감지
            if (Math.abs(deltaX) > 10) {
                isSwiping = true;
                // 스크롤은 막지 않음 (좋은 UX를 위해)
            }
        };
        
        // 터치 종료
        const handleTouchEnd = (e) => {
            if (!isSwiping || !touchStartX || !touchStartY) {
                touchStartX = 0;
                touchStartY = 0;
                return;
            }
            
            const touch = e.changedTouches?.[0] || e.touches?.[0];
            if (!touch) {
                touchStartX = 0;
                touchStartY = 0;
                return;
            }
            
            const finalDeltaX = touchStartX - touch.clientX;
            
            // 스와이프 감지
            if (Math.abs(finalDeltaX) > SWIPE_THRESHOLD) {
                if (finalDeltaX > 0) {
                    // 오른쪽으로 스와이프 (이전 응답)
                    this.swipeMessage(wrapper, -1);
                } else {
                    // 왼쪽으로 스와이프 (다음 응답)
                    this.swipeMessage(wrapper, 1);
                }
            }
            
            touchStartX = 0;
            touchStartY = 0;
            isSwiping = false;
        };
        
        // 메시지 영역에 터치 이벤트 리스너 추가
        messageDiv.addEventListener('touchstart', handleTouchStart, { passive: true });
        messageDiv.addEventListener('touchmove', handleTouchMove, { passive: true });
        messageDiv.addEventListener('touchend', handleTouchEnd, { passive: true });
        */
    }
    
    /**
     * 메시지 스와이프 (다른 응답으로 전환 또는 새 응답 생성)
     * @param {HTMLElement} wrapper - 메시지 래퍼 요소
     * @param {number} direction - 스와이프 방향 (-1: 이전, 1: 다음)
     */
    async swipeMessage(wrapper, direction) {
        const swipesData = wrapper.dataset.swipes;
        if (!swipesData) return;
        
        const swipes = JSON.parse(swipesData);
        let currentIndex = parseInt(wrapper.dataset.swipeIndex || '0');
        
        // 새로운 인덱스 계산
        let newIndex = currentIndex + direction;
        
        // 이전 버튼: 범위 체크
        if (direction === -1) {
            if (newIndex < 0) {
                return;
            }
        } 
        // 다음 버튼: 범위를 벗어나면 새 스와이프 생성
        else if (direction === 1) {
            if (newIndex >= swipes.length) {
                // 새 스와이프 생성
                await this.generateNewSwipe(wrapper);
                return;
            }
        }
        
        // 원본 텍스트 업데이트
        wrapper.dataset.originalText = swipes[newIndex];
        
        // 스와이프 텍스트에 정규식 적용 (AI 출력)
        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
        // 실리태번과 동일: 스와이프 시에도 정규식 적용 (isMarkdown: true)
        const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        const wrapperIndex = Array.from(chatMessages).indexOf(wrapper);
        const usableMessages = Array.from(chatMessages).filter(w => {
            const role = w.dataset.role;
            return role === 'user' || role === 'assistant';
        });
        const messageIndex = Array.from(usableMessages).indexOf(wrapper);
        const depth = messageIndex !== -1 ? usableMessages.length - messageIndex - 1 : undefined;
        
        // 실리태번과 동일: 스와이프 시에도 characterOverride 전달
        const characterName = wrapper.dataset.characterName || undefined;
        
        // 사용자 이름 가져오기
        let userName = '';
        try {
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            if (currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentPersonaId);
                if (persona?.name) {
                    userName = persona.name;
                }
            }
        } catch (error) {
            // 무시
        }
        
        // HTML 코드 블록을 먼저 추출하여 정규식과 매크로 치환이 내부를 건드리지 않도록 보호
        // processHtmlCodeBlocks - 전역 스코프에서 사용
        const htmlBlockProcessResult = processHtmlCodeBlocks(swipes[newIndex]);
        const textWithoutHtmlBlocks = typeof htmlBlockProcessResult === 'string' ? htmlBlockProcessResult : htmlBlockProcessResult.text;
        const extractedHtmlBlocks = typeof htmlBlockProcessResult === 'object' && htmlBlockProcessResult.htmlBlocks ? htmlBlockProcessResult.htmlBlocks : [];
        
        // 정규식 적용 (HTML 블록 제외한 텍스트에만)
        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
        let processedSwipeText = await getRegexedString(textWithoutHtmlBlocks, REGEX_PLACEMENT.AI_OUTPUT, {
            characterOverride: characterName,
            isMarkdown: true,
            isPrompt: false,
            depth: depth
        });
        
        // {{user}}, {{char}} 매크로 치환 적용 (정규식 적용 후, HTML 블록 제외 텍스트에만)
        // substituteParams - 전역 스코프에서 사용
        processedSwipeText = substituteParams(processedSwipeText, userName, characterName || '');
        
        // HTML 코드 블록 내부의 매크로 치환 (원본 HTML 블록에 적용)
        if (extractedHtmlBlocks.length > 0) {
            extractedHtmlBlocks.forEach((block) => {
                block.html = substituteParams(block.html, userName, characterName || '');
            });
        }
        
        // HTML 코드 블록을 다시 코드 블록 형태로 복원하여 processedText에 추가
        if (extractedHtmlBlocks.length > 0) {
            extractedHtmlBlocks.forEach((block) => {
                const marker = `<!-- HTML_IFRAME_MARKER:${block.id} -->`;
                const codeBlock = `\`\`\`html\n${block.html}\n\`\`\``;
                processedSwipeText = processedSwipeText.replace(marker, codeBlock);
            });
        }
        
        const processedSwipeTextWithMacros = processedSwipeText;
        
        // 메시지 텍스트 업데이트
        const messageText = wrapper.querySelector('.message-text');
        const content = wrapper.querySelector('.message-content');
        messageText.innerHTML = messageFormatting(processedSwipeTextWithMacros, userName, characterName || '');
        
        // HTML 렌더링 제한 확인 및 적용
        let shouldSkipHtmlRender = false;
        try {
            const settings = await SettingsStorage.load();
            const htmlRenderLimit = settings.htmlRenderLimit ?? 0;
            
            if (htmlRenderLimit > 0) {
                // 현재 메시지가 제한 범위 내에 있는지 확인
                const allMessages = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                    .filter(w => !w.classList.contains('message-hidden') && w.style.display !== 'none');
                const totalMessageCount = allMessages.length;
                
                // 이 메시지의 역순 인덱스 계산 (최근 메시지 = 0)
                const messageIndex = allMessages.indexOf(wrapper);
                const reverseIndex = totalMessageCount - 1 - messageIndex;
                
                if (reverseIndex >= htmlRenderLimit) {
                    shouldSkipHtmlRender = true;
                } else {
                    shouldSkipHtmlRender = false;
                }
            }
        } catch (error) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20022', 'HTML 렌더링 제한 확인 실패 (swipeMessage)', error);
            }
        }
        
        this.renderHtmlIframesInElement(messageText, shouldSkipHtmlRender);
        
        // 인덱스 업데이트
        wrapper.dataset.swipeIndex = newIndex.toString();
        
        // 스와이프 버튼 상태 업데이트
        const swipeControls = wrapper.querySelector('.message-swipe-controls');
        if (swipeControls) {
            const swipeLeftBtn = swipeControls.querySelector('.swipe-left');
            const swipeRightBtn = swipeControls.querySelector('.swipe-right');
            const swipeIndicator = swipeControls.querySelector('.swipe-indicator');
            
            if (swipeLeftBtn) swipeLeftBtn.disabled = newIndex === 0;
            // 다음 버튼은 항상 활성화 (새 스와이프 생성 가능)
            if (swipeRightBtn) swipeRightBtn.disabled = false;
            if (swipeIndicator) swipeIndicator.textContent = `${newIndex + 1}/${swipes.length}`;
        }
        
        // 애니메이션 효과
        messageText.style.opacity = '0';
        setTimeout(() => {
            messageText.style.transition = 'opacity 0.2s ease-in';
            messageText.style.opacity = '1';
        }, 10);
    }
    
    /**
     * 새 스와이프 응답 생성
     * @param {HTMLElement} wrapper - 메시지 래퍼 요소
     */
    async generateNewSwipe(wrapper) {
        const swipesData = wrapper.dataset.swipes;
        if (!swipesData) return;
        
        const swipes = JSON.parse(swipesData);
        const currentIndex = parseInt(wrapper.dataset.swipeIndex || '0');
        
        // TODO: 실제 AI 응답 생성 로직 구현
        // 현재는 임시로 새 응답 생성
        const newSwipe = `새로운 응답 ${swipes.length + 1}입니다. (실제 AI 생성 기능은 추후 구현 예정)`;
        
        // swipes 배열에 새 응답 추가
        swipes.push(newSwipe);
        wrapper.dataset.swipes = JSON.stringify(swipes);
        
        const newIndex = swipes.length - 1;
        wrapper.dataset.swipeIndex = newIndex.toString();
        
        // 원본 텍스트 업데이트
        wrapper.dataset.originalText = newSwipe;
        
        // 새 스와이프 텍스트에 정규식 적용 (AI 출력)
        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
        // 실리태번과 동일: 새 스와이프에도 정규식 적용 (isMarkdown: true)
        const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        const usableMessages = Array.from(chatMessages).filter(w => {
            const role = w.dataset.role;
            return role === 'user' || role === 'assistant';
        });
        const messageIndex = Array.from(usableMessages).indexOf(wrapper);
        const depth = messageIndex !== -1 ? usableMessages.length - messageIndex - 1 : undefined;
        
        // 실리태번과 동일: 새 스와이프에도 characterOverride 전달
        const characterName = wrapper.dataset.characterName || undefined;
        const processedNewSwipe = await getRegexedString(newSwipe, REGEX_PLACEMENT.AI_OUTPUT, {
            characterOverride: characterName,
            isMarkdown: true,
            isPrompt: false,
            depth: depth
        });
        
        // {{user}}, {{char}} 매크로 치환 적용
        // substituteParams - 전역 스코프에서 사용
        let userName = '';
        try {
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            if (currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentPersonaId);
                if (persona?.name) {
                    userName = persona.name;
                }
            }
        } catch (error) {
            // 무시
        }
        const processedNewSwipeWithMacros = substituteParams(processedNewSwipe, userName, characterName || '');
        
        // 메시지 텍스트 업데이트
        const messageText = wrapper.querySelector('.message-text');
        const content = wrapper.querySelector('.message-content');
        messageText.innerHTML = messageFormatting(processedNewSwipeWithMacros, userName, characterName || '');
        this.renderHtmlIframesInElement(messageText);
        
        // 스와이프 버튼 상태 업데이트
        const swipeControls = wrapper.querySelector('.message-swipe-controls');
        if (swipeControls) {
            const swipeLeftBtn = swipeControls.querySelector('.swipe-left');
            const swipeRightBtn = swipeControls.querySelector('.swipe-right');
            const swipeIndicator = swipeControls.querySelector('.swipe-indicator');
            
            if (swipeLeftBtn) swipeLeftBtn.disabled = false;
            if (swipeRightBtn) swipeRightBtn.disabled = false;
            if (swipeIndicator) swipeIndicator.textContent = `${newIndex + 1}/${swipes.length}`;
        }
        
        // 애니메이션 효과
        messageText.style.opacity = '0';
        setTimeout(() => {
            messageText.style.transition = 'opacity 0.2s ease-in';
            messageText.style.opacity = '1';
        }, 10);
    }
    
    /**
     * HTML에서 원본 텍스트 추출
     * 각 <p> 태그를 줄바꿈으로 변환하여 원본 마크다운 텍스트 복원
     * @param {string} html - HTML 문자열
     * @returns {string} - 원본 텍스트
     */
    extractTextFromHTML(html) {
        if (!html) return '';
        
        // 임시 div에 HTML 삽입하여 파싱
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // 각 <p> 태그의 텍스트를 추출하고 줄바꿈으로 연결
        const paragraphs = tempDiv.querySelectorAll('p');
        if (paragraphs.length === 0) {
            // <p> 태그가 없으면 일반 텍스트로 처리
            return tempDiv.textContent || tempDiv.innerText || '';
        }
        
        return Array.from(paragraphs).map(p => {
            // <br> 태그를 줄바꿈으로 변환
            const brReplaced = p.innerHTML.replace(/<br\s*\/?>/gi, '\n');
            const tempP = document.createElement('div');
            tempP.innerHTML = brReplaced;
            const text = tempP.textContent || tempP.innerText || '';
            return text;
        }).join('\n');
    }
    
    /**
     * 메시지 편집 (인라인 편집 모드)
     * 메시지를 textarea로 교체하여 편집 가능하게 만듦
     * @param {HTMLElement} messageWrapper - 메시지 래퍼 요소
     */
    async editMessage(messageWrapper) {
        // 이미 편집 모드인지 확인
        if (messageWrapper.classList.contains('editing')) {
            return;
        }
        
        const messageText = messageWrapper.querySelector('.message-text');
        if (!messageText) return;
        
        // 실리태번과 동일: this.chat 배열에서 메시지 찾기 (이미 저장된 메시지 텍스트 사용)
        const messageUuid = messageWrapper.dataset.messageUuid;
        let editText = '';
        
        if (messageUuid && this.chat) {
            const chatMessage = this.chat.find(msg => msg.uuid === messageUuid);
            if (chatMessage && chatMessage.mes) {
                // 실리태번과 동일: chat[editMessageId].mes 사용
                editText = chatMessage.mes.trim();
                
                // 스와이프가 있는 경우 현재 스와이프 텍스트 사용
                const swipesData = messageWrapper.dataset.swipes;
                if (swipesData) {
                    const swipes = JSON.parse(swipesData);
                    const currentIndex = parseInt(messageWrapper.dataset.swipeIndex || '0');
                    if (chatMessage.swipes && Array.isArray(chatMessage.swipes) && chatMessage.swipes[currentIndex]) {
                        editText = chatMessage.swipes[currentIndex].trim();
                    }
                }
                
                console.log('[ChatManager.editMessage] 편집 입력창 텍스트:', {
                    uuid: messageUuid.substring(0, 8),
                    editText: editText.substring(0, 50),
                    source: 'this.chat[].mes'
                });
            }
        }
        
        // 폴백: dataset이나 HTML에서 추출
        if (!editText) {
            editText = messageWrapper.dataset.originalText || this.extractTextFromHTML(messageText.innerHTML);
            editText = editText ? editText.trim() : '';
            
            if (editText) {
                console.log('[ChatManager.editMessage] 편집 입력창 텍스트 (폴백):', {
                    uuid: messageUuid ? messageUuid.substring(0, 8) : 'unknown',
                    editText: editText.substring(0, 50),
                    source: 'dataset.originalText or HTML'
                });
            }
        }
        
        if (!editText) return;
        
        // 편집 모드로 표시
        messageWrapper.classList.add('editing');
        
        // 원본 텍스트 저장 (취소 시 사용)
        messageWrapper.dataset.originalText = editText;
        
        // 메시지 텍스트를 textarea로 교체 (실리태번과 동일: chat[editMessageId].mes 사용)
        const editTextarea = document.createElement('textarea');
        editTextarea.className = 'message-edit-textarea';
        editTextarea.value = editText; // 저장된 메시지 텍스트 (이미 정규식 적용된 상태)
        editTextarea.setAttribute('rows', '1');
        
        // textarea 높이 자동 조절
        editTextarea.style.resize = 'none';
        editTextarea.style.overflow = 'auto';
        editTextarea.style.minHeight = '40px';
        editTextarea.style.maxHeight = '400px';
        
        // 높이 자동 조절 함수
        const adjustHeight = () => {
            editTextarea.style.height = 'auto';
            const newHeight = Math.min(editTextarea.scrollHeight, 400);
            editTextarea.style.height = `${newHeight}px`;
        };
        
        editTextarea.addEventListener('input', adjustHeight);
        
        // 메시지 텍스트 교체
        messageText.style.display = 'none';
        messageText.parentNode.insertBefore(editTextarea, messageText);
        
        // 초기 높이 자동 조절 (실리태번과 동일: height(0) 후 height(scrollHeight))
        // DOM에 추가된 후에야 scrollHeight가 정확히 계산됨
        requestAnimationFrame(() => {
            adjustHeight();
        });
        
        // 편집 버튼 숨기기
        const actionButtons = messageWrapper.querySelector('.message-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
        
        // 편집 컨트롤 버튼 추가
        const editControls = document.createElement('div');
        editControls.className = 'message-edit-controls';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'message-edit-save-btn';
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        saveBtn.setAttribute('aria-label', '저장');
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.saveEdit(messageWrapper, editTextarea);
        });
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'message-edit-cancel-btn';
        cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        cancelBtn.setAttribute('aria-label', '취소');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cancelEdit(messageWrapper, editTextarea);
        });
        
        editControls.appendChild(saveBtn);
        editControls.appendChild(cancelBtn);
        
        // 컨텐츠 영역에 편집 컨트롤 추가
        const messageContent = messageWrapper.querySelector('.message-content');
        if (messageContent) {
            messageContent.appendChild(editControls);
        }
        
        // textarea 포커스 및 높이 조절
        setTimeout(() => {
            editTextarea.focus();
            editTextarea.setSelectionRange(editText.length, editText.length);
            adjustHeight();
        }, 10);
        
        // Enter로 저장, Escape로 취소
        editTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.saveEdit(messageWrapper, editTextarea);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEdit(messageWrapper, editTextarea);
            }
        });
    }
    
    /**
     * 편집 저장
     * 
     * ⚠️ 중요: 정규식과 HTML 렌더링 제한 적용
     * - 정규식 적용: isEdit: true로 전달 (runOnEdit이 true인 스크립트만 적용)
     * - HTML 렌더링 제한: 메시지 저장 후 applyHtmlRenderLimit 적용 (렌더링 제한이 정규식보다 우선)
     * - 정규식이 적용된 HTML 콘텐츠도 렌더링 제한에 따라 플레이스홀더로 표시될 수 있음
     * 
     * @param {HTMLElement} messageWrapper - 메시지 래퍼 요소
     * @param {HTMLTextAreaElement} editTextarea - 편집 textarea
     */
    async saveEdit(messageWrapper, editTextarea) {
        const newText = editTextarea.value.trim();
        const messageText = messageWrapper.querySelector('.message-text');
        
        if (!messageText) return;
        
        // 메시지 타입 확인 (assistant인지 user인지)
        const messageDiv = messageWrapper.querySelector('.message');
        const isAssistant = messageDiv && messageDiv.classList.contains('assistant');
        const isUser = messageDiv && messageDiv.classList.contains('user');
        
        // 캐릭터 이름 가져오기 (정규식 적용 및 표시용)
        const characterName = isAssistant ? (messageWrapper.dataset.characterName || undefined) : undefined;
        
        // depth 계산 (정규식 적용 및 표시용)
            const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
            const usableMessages = Array.from(chatMessages).filter(w => {
                const role = w.dataset.role;
                return role === 'user' || role === 'assistant';
            });
            const messageIndex = Array.from(usableMessages).indexOf(messageWrapper);
            const depth = messageIndex !== -1 ? usableMessages.length - messageIndex - 1 : undefined;
            
        // 정규식 적용 (사용자가 편집한 텍스트를 그대로 사용)
        let processedText = newText;
        if (isAssistant || isUser) {
            // AI 출력 또는 사용자 입력 정규식 적용
            // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
            // 실리태번과 동일: 편집 저장 시에도 정규식 적용 (isMarkdown: true, isEdit: true)
            const placement = isAssistant ? REGEX_PLACEMENT.AI_OUTPUT : REGEX_PLACEMENT.USER_INPUT;
            
            // 실리태번과 동일: 직접 편집 시에는 isEdit: true만 전달하고 isMarkdown은 전달하지 않음 (undefined)
            // updateMessage 함수 참고: { characterOverride, isEdit: true }만 전달
            // isMarkdown을 전달하지 않으면 undefined가 되어, !isMarkdown은 true가 됨
            // 따라서 markdownOnly와 promptOnly가 모두 false인 스크립트는 적용됨
            const regexOptions = {
                characterOverride: characterName,
                // isMarkdown 전달하지 않음 (실리태번과 동일) → undefined
                // isPrompt 전달하지 않음 (실리태번과 동일) → undefined
                isEdit: true,
                depth: depth
            };
            
            // 디버그: 직접 편집 시 정규식 옵션 확인
            console.log('[ChatManager.saveEdit] 정규식 호출 전:', {
                isAssistant,
                isUser,
                placement,
                newText: newText.substring(0, 50),
                regexOptions: {
                    characterOverride: regexOptions.characterOverride,
                    isMarkdown: regexOptions.isMarkdown === undefined ? 'undefined' : regexOptions.isMarkdown,
                    isPrompt: regexOptions.isPrompt === undefined ? 'undefined' : regexOptions.isPrompt,
                    isEdit: regexOptions.isEdit,
                    depth: regexOptions.depth
                }
            });
            
            try {
                processedText = await getRegexedString(newText, placement, regexOptions);
                console.log('[ChatManager.saveEdit] 정규식 호출 후:', {
                    processedText: processedText.substring(0, 50),
                    changed: newText !== processedText
                });
            } catch (error) {
                console.error('[ChatManager.saveEdit] 정규식 호출 오류:', error);
                processedText = newText; // 오류 시 원본 텍스트 사용
            }
        } else {
            console.log('[ChatManager.saveEdit] 정규식 스킵: 메시지 타입이 assistant나 user가 아님', { isAssistant, isUser });
        }
        
        // 사용자 이름과 캐릭터 이름 가져오기 (매크로 치환용)
        let userName = '';
        let charName = '';
        
        try {
            // CharacterStorage - 전역 스코프에서 사용
            // UserPersonaStorage - 전역 스코프에서 사용
            // SettingsStorage - 전역 스코프에서 사용
            
            // 캐릭터 이름 가져오기
            charName = messageWrapper.dataset.characterName || '';
            if (!charName) {
                const currentCharacterId = await CharacterStorage.loadCurrent();
                if (currentCharacterId) {
                    const character = await CharacterStorage.load(currentCharacterId);
                    if (character?.data?.name || character?.name) {
                        charName = character.data?.name || character.name;
                    }
                }
            }
            
            // 사용자 이름 가져오기
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            if (currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentPersonaId);
                if (persona?.name) {
                    userName = persona.name;
                }
            }
        } catch (error) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20009', '사용자/캐릭터 정보 로드 실패', error);
            }
        }
        
        // 원본 텍스트 업데이트 (정규식 적용 전 원본 저장)
        messageWrapper.dataset.originalText = newText;
        
        // 스와이프 데이터가 있으면 현재 스와이프도 업데이트 (저장용: 정규식 적용된 텍스트)
        const swipesData = messageWrapper.dataset.swipes;
        if (swipesData) {
            const swipes = JSON.parse(swipesData);
            const currentIndex = parseInt(messageWrapper.dataset.swipeIndex || '0');
            swipes[currentIndex] = processedText; // 저장용: isMarkdown 없이 정규식 적용된 텍스트
            messageWrapper.dataset.swipes = JSON.stringify(swipes);
        }
        
        // {{user}}, {{char}} 매크로 치환 적용 (저장용 텍스트)
        // 실리태번과 동일: updateMessage에서 getRegexedString(isEdit: true) 후 substituteParams만 적용
        const processedTextForStorage = substituteParams(processedText, userName, charName);
        
        // DOM 표시용: 실리태번과 동일하게 저장된 텍스트에 isMarkdown: true로 정규식 다시 적용
        // 실리태번의 messageFormatting 함수 참고: getRegexedString(mes, regexPlacement, { isMarkdown: true, ... })
        // 표시 시에는 항상 isMarkdown: true로 정규식 적용 (markdownOnly 정규식 포함)
        let processedTextForDisplay = processedTextForStorage;
        if (isAssistant || isUser) {
            const placement = isAssistant ? REGEX_PLACEMENT.AI_OUTPUT : REGEX_PLACEMENT.USER_INPUT;
            const regexOptionsForDisplay = {
                characterOverride: characterName,
                isMarkdown: true, // 표시용: markdownOnly 정규식도 적용
                isPrompt: false,
                isEdit: false, // 표시이므로 편집 모드 아님
                depth: depth
            };
            
            // 저장된 텍스트에 markdownOnly 정규식 추가 적용
            processedTextForDisplay = await getRegexedString(processedTextForStorage, placement, regexOptionsForDisplay);
        }
        
        // {{user}}, {{char}} 매크로 치환 적용 (표시용 텍스트 - 이미 적용되었지만 혹시 모를 경우를 위해)
        const processedTextForDisplayWithMacros = processedTextForDisplay;
        
        // HTML 렌더링 제한 확인 (범위 밖 메시지는 렌더링하지 않음)
        let shouldSkipHtmlRender = false;
        try {
            const settings = await SettingsStorage.load();
            const htmlRenderLimit = settings.htmlRenderLimit ?? 0;
            
            console.log('[ChatManager.saveEdit] HTML 렌더링 제한 확인 시작:', {
                htmlRenderLimit,
                settingsHasLimit: 'htmlRenderLimit' in settings
            });
            
            if (htmlRenderLimit > 0) {
                // 모든 메시지 래퍼 가져오기
                const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                    .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
                
                // 역순 인덱스 계산: 최근 메시지가 인덱스 0, 1, 2...
                const reversedWrappers = [...allMessageWrappers].reverse();
                const messageIndex = reversedWrappers.indexOf(messageWrapper);
                
                // 범위 밖이면 렌더링 건너뛰기
                if (messageIndex >= htmlRenderLimit) {
                    shouldSkipHtmlRender = true;
                }
                
                console.log('[ChatManager.saveEdit] HTML 렌더링 제한 확인:', {
                    htmlRenderLimit,
                    totalMessages: allMessageWrappers.length,
                    messageIndex,
                    shouldSkipHtmlRender,
                    messageUuid: messageWrapper.dataset.messageUuid?.substring(0, 8)
                });
            } else {
                console.log('[ChatManager.saveEdit] HTML 렌더링 제한 없음 (htmlRenderLimit: 0)');
            }
        } catch (error) {
            // 오류 시 기본적으로 렌더링
            console.warn('[ChatManager.saveEdit] HTML 렌더링 제한 확인 실패:', error);
        }
        
        // 새 텍스트로 업데이트 (표시용: isMarkdown: true로 정규식 적용된 텍스트)
        const content = messageWrapper.querySelector('.message-content');
        // 기존 iframe 등 모든 동적 콘텐츠 제거를 위해 innerHTML 완전 교체
        messageText.innerHTML = '';
        
        if (shouldSkipHtmlRender) {
            // 범위 밖이면 messageFormatting으로 iframe을 생성한 후 플레이스홀더로 교체
            messageText.innerHTML = messageFormatting(processedTextForDisplayWithMacros, userName, charName);
            // 플레이스홀더로 교체 (skipRender: true)
            this.renderHtmlIframesInElement(messageText, true);
        } else {
            // 범위 내이면 messageFormatting으로 렌더링
            messageText.innerHTML = messageFormatting(processedTextForDisplayWithMacros, userName, charName);
            // iframe 재렌더링 (편집 완료 시 선택지 등도 업데이트)
            this.renderHtmlIframesInElement(messageText, false);
        }
        messageText.style.display = '';
        
        // textarea 제거
        editTextarea.remove();
        
        // 편집 컨트롤 제거
        const editControls = messageWrapper.querySelector('.message-edit-controls');
        if (editControls) {
            editControls.remove();
        }
        
        // 편집 모드 해제
        messageWrapper.classList.remove('editing');
        
        // 액션 버튼 다시 표시
        const actionButtons = messageWrapper.querySelector('.message-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = '';
        }
        
        // this.chat 배열 업데이트 (편집된 메시지 반영)
        const messageUuid = messageWrapper.dataset.messageUuid;
        if (messageUuid && this.chat) {
            const messageIndex = this.chat.findIndex(msg => msg.uuid === messageUuid);
            if (messageIndex !== -1) {
                // 메시지 내용 업데이트 (저장용: isMarkdown 없이 정규식 적용된 텍스트)
                const oldText = this.chat[messageIndex].mes;
                this.chat[messageIndex].mes = processedTextForStorage;
                console.log('[ChatManager.saveEdit] this.chat 배열 업데이트:', {
                    uuid: messageUuid.substring(0, 8),
                    oldText: oldText?.substring(0, 50),
                    newText: processedTextForStorage.substring(0, 50),
                    changed: oldText !== processedTextForStorage
                });
                // 스와이프가 있으면 현재 스와이프도 업데이트
                if (swipesData) {
                    const swipes = JSON.parse(swipesData);
                    const currentIndex = parseInt(messageWrapper.dataset.swipeIndex || '0');
                    if (this.chat[messageIndex].swipes && Array.isArray(this.chat[messageIndex].swipes)) {
                        this.chat[messageIndex].swipes[currentIndex] = processedTextForStorage;
                    }
                }
            } else {
                console.warn('[ChatManager.saveEdit] this.chat에서 메시지를 찾을 수 없음:', messageUuid.substring(0, 8));
            }
        }
        
        // 편집 저장 후 즉시 채팅 저장 (DOM 업데이트 완료 대기)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await this.saveChat();
    }
    
    /**
     * 편집 취소
     * 
     * ⚠️ 중요: 정규식과 HTML 렌더링 제한 적용
     * - 정규식 적용: 원본 텍스트에 isMarkdown: true로 전달 (모든 정규식 스크립트 적용)
     * - HTML 렌더링 제한: 메시지 복원 후 applyHtmlRenderLimit 적용 (렌더링 제한이 정규식보다 우선)
     * - 정규식이 적용된 HTML 콘텐츠도 렌더링 제한에 따라 플레이스홀더로 표시될 수 있음
     * 
     * @param {HTMLElement} messageWrapper - 메시지 래퍼 요소
     * @param {HTMLTextAreaElement} editTextarea - 편집 textarea
     */
    async cancelEdit(messageWrapper, editTextarea) {
        const originalText = messageWrapper.dataset.originalText || '';
        const messageText = messageWrapper.querySelector('.message-text');
        
        if (!messageText) return;
        
        // 메시지 타입 확인 (assistant인지 user인지)
        const messageDiv = messageWrapper.querySelector('.message');
        const isAssistant = messageDiv && messageDiv.classList.contains('assistant');
        const isUser = messageDiv && messageDiv.classList.contains('user');
        
        // 정규식 적용 (원본 텍스트에 다시 적용)
        let processedText = originalText;
        if (isAssistant || isUser) {
            // AI 출력 또는 사용자 입력 정규식 적용
            // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
            // 실리태번과 동일: 편집 취소 시에도 정규식 적용 (isMarkdown: true, isEdit: true)
            const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
            const usableMessages = Array.from(chatMessages).filter(w => {
                const role = w.dataset.role;
                return role === 'user' || role === 'assistant';
            });
            const messageIndex = Array.from(usableMessages).indexOf(messageWrapper);
            const depth = messageIndex !== -1 ? usableMessages.length - messageIndex - 1 : undefined;
            
            const placement = isAssistant ? REGEX_PLACEMENT.AI_OUTPUT : REGEX_PLACEMENT.USER_INPUT;
            const characterName = isAssistant ? (messageWrapper.dataset.characterName || undefined) : undefined;
            
            const regexOptions = {
                characterOverride: characterName,
                isMarkdown: true,
                isPrompt: false,
                isEdit: false,
                depth: depth
            };
            
            processedText = await getRegexedString(originalText, placement, regexOptions);
        }
        
        // {{user}}, {{char}} 매크로 치환 적용
        // substituteParams - 전역 스코프에서 사용
        let userName = '';
        let charName = '';
        try {
            // CharacterStorage, UserPersonaStorage, SettingsStorage - 전역 스코프에서 사용
            charName = messageWrapper.dataset.characterName || '';
            if (!charName) {
                const currentCharacterId = await CharacterStorage.loadCurrent();
                if (currentCharacterId) {
                    const character = await CharacterStorage.load(currentCharacterId);
                    if (character?.data?.name || character?.name) {
                        charName = character.data?.name || character.name;
                    }
                }
            }
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            if (currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentPersonaId);
                if (persona?.name) {
                    userName = persona.name;
                }
            }
        } catch (error) {
            // 무시
        }
        const processedTextWithMacros = substituteParams(processedText, userName, charName);
        
        // HTML 렌더링 제한 확인 (범위 밖 메시지는 렌더링하지 않음)
        let shouldSkipHtmlRender = false;
        try {
            const settings = await SettingsStorage.load();
            const htmlRenderLimit = settings.htmlRenderLimit ?? 0;
            
            console.log('[ChatManager.cancelEdit] HTML 렌더링 제한 확인 시작:', {
                htmlRenderLimit,
                settingsHasLimit: 'htmlRenderLimit' in settings
            });
            
            if (htmlRenderLimit > 0) {
                // 모든 메시지 래퍼 가져오기
                const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'))
                    .filter(wrapper => !wrapper.classList.contains('message-hidden') && wrapper.style.display !== 'none');
                
                // 역순 인덱스 계산: 최근 메시지가 인덱스 0, 1, 2...
                const reversedWrappers = [...allMessageWrappers].reverse();
                const messageIndex = reversedWrappers.indexOf(messageWrapper);
                
                // 범위 밖이면 렌더링 건너뛰기
                if (messageIndex >= htmlRenderLimit) {
                    shouldSkipHtmlRender = true;
                }
                
                console.log('[ChatManager.cancelEdit] HTML 렌더링 제한 확인:', {
                    htmlRenderLimit,
                    totalMessages: allMessageWrappers.length,
                    messageIndex,
                    shouldSkipHtmlRender,
                    messageUuid: messageWrapper.dataset.messageUuid?.substring(0, 8)
                });
            } else {
                console.log('[ChatManager.cancelEdit] HTML 렌더링 제한 없음 (htmlRenderLimit: 0)');
            }
        } catch (error) {
            // 오류 시 기본적으로 렌더링
            console.warn('[ChatManager.cancelEdit] HTML 렌더링 제한 확인 실패:', error);
        }
        
        // 정규식 적용된 텍스트로 복원 (기존 내용 완전히 교체)
        const content = messageWrapper.querySelector('.message-content');
        // 기존 iframe 등 모든 동적 콘텐츠 제거를 위해 innerHTML 완전 교체
        messageText.innerHTML = '';
        
        if (shouldSkipHtmlRender) {
            // 범위 밖이면 messageFormatting으로 iframe을 생성한 후 플레이스홀더로 교체
            messageText.innerHTML = messageFormatting(processedTextWithMacros, userName, charName);
            // 플레이스홀더로 교체 (skipRender: true)
            this.renderHtmlIframesInElement(messageText, true);
        } else {
            // 범위 내이면 messageFormatting으로 렌더링
            messageText.innerHTML = messageFormatting(processedTextWithMacros, userName, charName);
            // iframe 재렌더링 (편집 취소 시 선택지 등도 원래 상태로 복원)
            this.renderHtmlIframesInElement(messageText, false);
        }
        messageText.style.display = '';
        
        // textarea 제거
        editTextarea.remove();
        
        // 편집 컨트롤 제거
        const editControls = messageWrapper.querySelector('.message-edit-controls');
        if (editControls) {
            editControls.remove();
        }
        
        // 편집 모드 해제
        messageWrapper.classList.remove('editing');
        // originalText는 유지 (다음 편집을 위해)
        
        // 액션 버튼 다시 표시
        const actionButtons = messageWrapper.querySelector('.message-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = '';
        }
    }
    
    /**
     * 메시지 삭제
     * 스와이프가 여러 개인 경우 스와이프 삭제 또는 메시지 삭제 선택 가능
     * 
     * 중요: 삭제된 메시지는 DOM에서 완전히 제거되므로, getChatHistory()에서 자동으로 제외됩니다.
     * getChatHistory()는 querySelectorAll('.message-wrapper')로 DOM을 읽기 때문에,
     * 삭제된 메시지는 챗 히스토리에 포함되지 않습니다.
     * 
     * @param {HTMLElement} messageWrapper - 메시지 래퍼 요소
     */
    /**
     * 프롬프트 정보 모달 표시
     * @param {HTMLElement} messageWrapper - 메시지 래퍼 요소
     */
    async showPromptInfoModal(messageWrapper) {
        if (!messageWrapper) {
            return;
        }
        
        const messageUuid = messageWrapper.dataset.messageUuid;
        if (!messageUuid) {
            if (typeof showToast === 'function') {
                showToast('메시지 정보를 찾을 수 없습니다.', 'error');
            }
            return;
        }
        
        const chatMessage = this.chat.find(msg => msg.uuid === messageUuid);
        if (!chatMessage) {
            if (typeof showToast === 'function') {
                showToast('메시지 정보를 찾을 수 없습니다.', 'error');
            }
            return;
        }
        
        const promptInfo = chatMessage.extra?.promptInfo;
        if (!promptInfo) {
            if (typeof showToast === 'function') {
                showToast('이 메시지에는 프롬프트 정보가 저장되어 있지 않습니다.', 'warning');
            }
            return;
        }
        
        // 기존 모달 제거
        const existingModal = document.getElementById('prompt-info-modal');
        if (existingModal) {
            existingModal.remove();
        }
        const existingOverlay = document.getElementById('prompt-info-modal-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.id = 'prompt-info-modal-overlay';
        
        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'prompt-info-modal';
        modal.id = 'prompt-info-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        // 헤더
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        const headerTitle = document.createElement('h2');
        headerTitle.textContent = '프롬프트 정보';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'icon-btn';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.setAttribute('aria-label', '닫기');
        modalHeader.appendChild(headerTitle);
        modalHeader.appendChild(closeBtn);
        
        // 바디
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        // API/Model 정보 섹션
        const infoSection = document.createElement('div');
        infoSection.className = 'prompt-info-section';
        const infoTitle = document.createElement('h3');
        infoTitle.className = 'prompt-info-title';
        infoTitle.textContent = 'API/Model 정보';
        const infoContent = document.createElement('div');
        infoContent.className = 'prompt-info-content';
        
        const apiProviderLabel = document.createElement('div');
        apiProviderLabel.className = 'prompt-info-label';
        apiProviderLabel.textContent = 'API Provider:';
        const apiProviderValue = document.createElement('div');
        apiProviderValue.className = 'prompt-info-value';
        apiProviderValue.textContent = promptInfo.apiProvider || 'N/A';
        
        const modelLabel = document.createElement('div');
        modelLabel.className = 'prompt-info-label';
        modelLabel.textContent = 'Model:';
        const modelValue = document.createElement('div');
        modelValue.className = 'prompt-info-value';
        modelValue.textContent = promptInfo.model || 'N/A';
        
        infoContent.appendChild(apiProviderLabel);
        infoContent.appendChild(apiProviderValue);
        infoContent.appendChild(modelLabel);
        infoContent.appendChild(modelValue);
        infoSection.appendChild(infoTitle);
        infoSection.appendChild(infoContent);
        
        // 프롬프트 내용 섹션
        const promptSection = document.createElement('div');
        promptSection.className = 'prompt-section';
        const promptTitle = document.createElement('h3');
        promptTitle.className = 'prompt-info-title';
        promptTitle.textContent = '프롬프트 내용';
        const promptContent = document.createElement('div');
        promptContent.className = 'prompt-content-container';
        const promptText = document.createElement('div');
        promptText.className = 'prompt-text';
        
        // 프롬프트 내용 추출 및 표시
        if (promptInfo.messages && Array.isArray(promptInfo.messages)) {
            const promptTextContent = promptInfo.messages
                .map(msg => {
                    if (typeof msg === 'string') {
                        return msg;
                    } else if (msg && typeof msg === 'object') {
                        // role 정보는 제외하고 content만 추출
                        if (typeof msg.content === 'string') {
                            return msg.content;
                        } else if (Array.isArray(msg.content)) {
                            // content가 배열인 경우 (예: multimodal)
                            return msg.content
                                .map(item => {
                                    if (typeof item === 'string') {
                                        return item;
                                    } else if (item && typeof item === 'object' && item.type === 'text') {
                                        return item.text || '';
                                    }
                                    return '';
                                })
                                .join('');
                        }
                        return '';
                    }
                    return '';
                })
                .filter(text => text && text.trim())
                .join('\n\n');
            
            promptText.textContent = promptTextContent || '프롬프트 내용이 비어있습니다.';
        } else {
            promptText.textContent = '프롬프트 정보가 없습니다.';
        }
        
        promptContent.appendChild(promptText);
        promptSection.appendChild(promptTitle);
        promptSection.appendChild(promptContent);
        
        modalBody.appendChild(infoSection);
        modalBody.appendChild(promptSection);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);
        
        // 닫기 함수
        const closeModal = () => {
            modal.classList.add('closing');
            overlay.classList.add('closing');
            
            setTimeout(() => {
                modal.remove();
                overlay.remove();
            }, 300);
        };
        
        // 이벤트 리스너
        closeBtn.addEventListener('click', () => {
            closeModal();
        });
        
        // 오버레이 클릭 시 닫기
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
        
        // 모달 자체 클릭 시 닫기 (모달 콘텐츠가 아닌 부분)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // 모달 콘텐츠 클릭 시 이벤트 전파 중지
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // DOM에 추가
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // 애니메이션 트리거 (다른 모달과 동일한 방식)
        // :not(.hidden):not(.closing) 조건에 맞으면 자동으로 애니메이션 실행됨
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // 애니메이션이 트리거되도록 강제 reflow
                void modal.offsetHeight;
                void overlay.offsetHeight;
            });
        });
    }

    async deleteMessage(messageWrapper) {
        if (!messageWrapper || !messageWrapper.parentNode) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20023', '메시지 래퍼가 유효하지 않음 (deleteMessage)');
            }
            return;
        }
        
        // 메시지 삭제 플래그 설정 (그리팅 추가 방지용)
        // 삭제 시작 시점에 플래그를 설정하여, 삭제 후 새 메시지 생성 시 그리팅이 추가되지 않도록 함
        this._messageDeletedRecently = true;
        // 5초 후 플래그 해제 (타임아웃으로 자동 해제)
        setTimeout(() => {
            this._messageDeletedRecently = false;
        }, 5000);
        
        // 메시지 래퍼의 참조를 안전하게 저장 (다이얼로그 이후에도 유효하도록)
        const wrapperToDelete = messageWrapper;
        const wrapperParent = messageWrapper.parentNode;
        
        // 스와이프 데이터 확인
        const swipesData = messageWrapper.dataset.swipes;
        const currentSwipeIndex = parseInt(messageWrapper.dataset.swipeIndex || '0');
        
        let swipes = [];
        if (swipesData) {
            try {
                swipes = JSON.parse(swipesData);
            } catch (e) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_CHAT_20024', '스와이프 데이터 파싱 실패 (deleteMessage)', e);
                }
                swipes = [];
            }
        }
        
        // 스와이프가 2개 이상이고 assistant 메시지인 경우 선택 다이얼로그 표시
        const messageDiv = messageWrapper.querySelector('.message');
        const isAssistant = messageDiv && messageDiv.classList.contains('assistant');
        const canDeleteSwipe = isAssistant && swipes.length > 1;
        
        if (canDeleteSwipe) {
            // 스와이프 삭제 또는 메시지 삭제 선택
            let choice;
            try {
                choice = await this.showDeleteConfirmDialog();
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_CHAT_3018', '메시지 삭제 다이얼로그 오류', error);
                }
                return;
            }
            
            if (!choice || typeof choice !== 'string') {
                return;
            }
            
            if (choice === 'cancel') {
                return;
            } else if (choice === 'swipe') {
                if (wrapperToDelete && wrapperToDelete.parentNode) {
                    this.deleteSwipe(wrapperToDelete, currentSwipeIndex);
                } else {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_CHAT_20025', '스와이프 삭제: 래퍼가 유효하지 않음');
                    }
                }
                return;
            } else if (choice === 'message') {
                // 메시지 전체 삭제 계속 진행
            } else {
                return;
            }
        }
        
        // 메시지 전체 삭제
        if (!wrapperToDelete || !wrapperToDelete.parentNode) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20026', '다이얼로그 후 메시지 래퍼가 유효하지 않음');
            }
            return;
        }
        
        // 삭제할 메시지의 UUID 저장 (나중에 확인용)
        const deletedMessageUuid = wrapperToDelete.dataset.messageUuid;
        
        // this.chat 배열에서 메시지 제거 (DOM 제거 전에 먼저 처리)
        if (deletedMessageUuid && this.chat) {
            const messageIndex = this.chat.findIndex(msg => msg.uuid === deletedMessageUuid);
            if (messageIndex !== -1) {
                this.chat.splice(messageIndex, 1);
                console.debug('[ChatManager.deleteMessage] this.chat 배열에서 메시지 제거:', deletedMessageUuid.substring(0, 8));
            }
        }
        
        // DOM에서 완전히 제거되므로, getChatHistory()에서 자동으로 제외됨
        wrapperToDelete.remove();
        
        // 전송 버튼 상태 업데이트 (메시지 개수 변경 반영)
        this.updateSendButtonState();
        
        // DOM 업데이트 완료 대기: 삭제된 메시지가 실제로 DOM에서 사라졌는지 확인
        // remove()는 동기적으로 실행되지만, 브라우저가 DOM을 업데이트하는 데 시간이 걸릴 수 있음
        let domUpdateComplete = false;
        let retryCount = 0;
        const maxRetries = 10;
        
        while (!domUpdateComplete && retryCount < maxRetries) {
            // DOM에서 삭제된 메시지가 실제로 사라졌는지 확인
            const stillExists = this.elements.chatMessages.contains(wrapperToDelete);
            if (!stillExists) {
                domUpdateComplete = true;
                break;
            }
            
            // DOM 업데이트 대기
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            retryCount++;
        }
        
        // 추가 안전장치: DOM 강제 리플로우
        this.elements.chatMessages.offsetHeight;
        
        // 삭제된 메시지 UUID를 임시로 저장 (saveChat에서 사용)
        if (deletedMessageUuid) {
            this._deletedMessageUuids = new Set([deletedMessageUuid]);
        }
        
        // 채팅 저장 (삭제 즉시 반영 - 디바운스 없이 바로 저장)
        // 플래그는 함수 시작 부분에서 이미 설정됨
        console.log('[deleteMessage] 저장 시작 (saveChat 호출)');
        await this.saveChat();
        // 저장 완료 후 삭제된 UUID 추적 해제
        this._deletedMessageUuids.clear();
        console.log('[deleteMessage] 저장 완료');
        
        // 메시지가 모두 삭제되면 환영 메시지 표시
        const remainingMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        if (remainingMessages.length === 0) {
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'welcome-message';
            welcomeMsg.innerHTML = '<p>캐릭터를 선택하고 채팅을 시작하세요.</p>';
            this.elements.chatMessages.appendChild(welcomeMsg);
        }
    }
    
    /**
     * 메시지 재생성
     * 해당 메시지(assistant)부터 이후 모든 메시지를 삭제하고 다시 생성
     * 실리태번과 동일: regenerate는 해당 메시지부터 이후 모든 메시지를 삭제하고 재생성
     * 상태창/선택지 지시문도 포함되어 전송됨 (excludeStatusBarChoice: false)
     * @param {HTMLElement} messageWrapper - 재생성할 메시지 래퍼 요소 (assistant 메시지)
     */
    async regenerateMessage(messageWrapper) {
        if (!messageWrapper || !messageWrapper.parentNode) return;
        
        // 중요: currentChatId를 저장하여 리롤 후에도 유지
        // 리롤 후 저장 시 새 채팅이 생성되는 것을 방지
        // currentChatId가 characterId와 같으면 잘못된 값이므로 null로 처리
        const savedCurrentChatId = (this.currentChatId && this.currentChatId !== this.currentCharacterId && this.currentChatId.includes('_')) 
            ? this.currentChatId 
            : null;
        const savedCurrentChatName = this.currentChatName;
        
        // 메시지 삭제 플래그 설정 (그리팅 추가 방지용)
        // 재생성 시작 시점에 플래그를 설정하여, 삭제 후 새 메시지 생성 시 그리팅이 추가되지 않도록 함
        this._messageDeletedRecently = true;
        // 5초 후 플래그 해제 (타임아웃으로 자동 해제)
        setTimeout(() => {
            this._messageDeletedRecently = false;
        }, 5000);
        
        // 생성 중이면 중단
        if (this.isGenerating) {
            await this.abortGeneration();
            // 중단 후 재생성 진행
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 편집 모드인지 확인
        if (messageWrapper.classList.contains('editing')) {
            showToast('편집 중인 메시지는 재생성할 수 없습니다. 먼저 편집을 완료하거나 취소하세요.', 'warning');
            return;
        }
        
        // assistant 메시지인지 확인
        const messageDiv = messageWrapper.querySelector('.message');
        const isAssistant = messageDiv && messageDiv.classList.contains('assistant');
        if (!isAssistant) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_CHAT_20027', '재생성 대상 메시지가 assistant가 아님');
            }
            return;
        }
        
        // 해당 메시지부터 이후 모든 메시지 찾기
        const allMessageWrappers = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'));
        const targetIndex = allMessageWrappers.indexOf(messageWrapper);
        
        if (targetIndex === -1) return;
        
        // 해당 메시지부터 마지막까지 모든 메시지 삭제
        const messagesToDelete = allMessageWrappers.slice(targetIndex);
        const deletedCount = messagesToDelete.length;
        
        // this.chat 배열에서도 메시지 제거 (DOM 제거 전에 먼저 처리)
        const deletedUuids = [];
        for (const wrapper of messagesToDelete) {
            const messageUuid = wrapper.dataset.messageUuid;
            if (messageUuid) {
                deletedUuids.push(messageUuid);
            }
        }
        
        if (this.chat && deletedUuids.length > 0) {
            // UUID 기준으로 역순으로 제거 (인덱스 변경 방지)
            for (const uuid of deletedUuids) {
                const messageIndex = this.chat.findIndex(msg => msg.uuid === uuid);
                if (messageIndex !== -1) {
                    this.chat.splice(messageIndex, 1);
                }
            }
            console.debug('[ChatManager.regenerateMessage] this.chat 배열에서', deletedUuids.length, '개 메시지 제거');
        }
        
        // DOM에서 메시지 제거
        const deletedUuidSet = new Set(deletedUuids);
        for (const wrapper of messagesToDelete) {
            wrapper.remove();
        }
        
        // DOM 업데이트 완료 대기: 삭제된 메시지가 실제로 DOM에서 사라졌는지 확인
        // remove()는 동기적으로 실행되지만, 브라우저가 DOM을 업데이트하는 데 시간이 걸릴 수 있음
        let domUpdateComplete = false;
        let retryCount = 0;
        const maxRetries = 10;
        
        while (!domUpdateComplete && retryCount < maxRetries) {
            // DOM에서 삭제된 메시지가 실제로 사라졌는지 확인
            const remainingMessages = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'));
            const stillExists = remainingMessages.some(wrapper => {
                const messageUuid = wrapper.dataset.messageUuid;
                return messageUuid && deletedUuidSet.has(messageUuid);
            });
            
            if (!stillExists) {
                domUpdateComplete = true;
                break;
            }
            
            // DOM 업데이트 대기
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            retryCount++;
        }
        
        // 추가 안전장치: DOM 강제 리플로우
        this.elements.chatMessages.offsetHeight;
        
        // 입력창 초기화 (재생성 시에는 메시지 추가 안 함)
        // 플래그는 함수 시작 부분에서 이미 설정됨
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = '44px';
        this.elements.messageInput.offsetHeight;
        
        // 중요: 리롤 = 단순히 메시지 삭제 -> 생성 요청
        // 1. 삭제 후 즉시 저장 (deleteMessage처럼)
        // 2. 그 다음 생성 요청
        // 3. 생성 완료 후 addMessage에서 자동 저장
        this._deletedMessageUuids = new Set(deletedUuids);
        console.log('[regenerateMessage] 메시지 삭제 후 저장 시작:', {
            deletedUuids: deletedUuids.length,
            deletedUuidsSet: this._deletedMessageUuids.size,
            savedCurrentChatId: savedCurrentChatId?.substring(0, 30) || 'null',
            currentChatId: this.currentChatId?.substring(0, 30) || 'null'
        });
        // currentChatId 복원 (리롤 후에도 기존 채팅 유지)
        if (!this.currentChatId && savedCurrentChatId) {
            this.currentChatId = savedCurrentChatId;
            this.currentChatName = savedCurrentChatName;
            console.log('[regenerateMessage] currentChatId 복원:', {
                chatId: savedCurrentChatId.substring(0, 30)
            });
        }
        // 삭제 후 즉시 저장 (deleteMessage처럼)
        await this.saveChat();
        // 저장 완료 후 삭제된 UUID 추적 해제 (다음 저장 시에는 영향 없도록)
        this._deletedMessageUuids.clear();
        console.log('[regenerateMessage] 메시지 삭제 후 저장 완료');
        
        // 재생성 시작: 삭제 후 남은 마지막 메시지를 확인 (DOM에서 직접 읽기)
        // 주의: getChatHistory()는 DOM에서 읽으므로 삭제된 메시지는 제외됨
        // DOM 업데이트가 완전히 반영되었는지 다시 한 번 확인
        // 삭제된 메시지가 DOM에 남아있는지 최종 확인
        let finalCheckComplete = false;
        let finalRetryCount = 0;
        const finalMaxRetries = 5;
        
        while (!finalCheckComplete && finalRetryCount < finalMaxRetries) {
            const remainingMessages = Array.from(this.elements.chatMessages.querySelectorAll('.message-wrapper'));
            const stillExists = remainingMessages.some(wrapper => {
                const messageUuid = wrapper.dataset.messageUuid;
                return messageUuid && deletedUuidSet.has(messageUuid);
            });
            
            if (!stillExists) {
                finalCheckComplete = true;
                break;
            }
            
            // DOM 업데이트 대기
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            finalRetryCount++;
        }
        
        // DOM 강제 리플로우 (최종 확인)
        this.elements.chatMessages.offsetHeight;
        
        const chatHistory = this.getChatHistory();
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
        
        // generateType 결정
        let generateType = 'normal';
        if (!lastMessage || lastMessage.role !== 'user') {
            generateType = 'continue';
        }
        
        // AbortController 생성 및 버튼 상태 변경 (sendMessage와 동일)
        this.abortController = new AbortController();
        this.isGenerating = true;
        this.updateSendButtonIcon('stop');
        this.updateAutofillButtonState();
        this.updateSendButtonState();
        await this.showAILoader(true); // AI 로더 표시
        
        // AI 응답 생성 (상태창/선택지 활성화 여부는 generateAIResponse 내부에서 확인됨)
        // generateAIResponse 내부에서 getChatHistory()를 다시 호출하므로 최신 DOM 상태 사용
        // 재생성 시에는 그리팅 체크 스킵 (삭제된 메시지에 그리팅이 포함되어 있을 수 있음)
        // DOM 업데이트를 다시 한 번 보장하기 위해 추가 대기
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
            await this.generateAIResponse('', generateType, true); // skipGreetingCheck = true
        } catch (error) {
            // AbortError 또는 사용자 정지 버튼 클릭은 정상적인 중단이므로 에러 메시지 표시하지 않음
            if (error.name === 'AbortError' || 
                error.message === '요청이 취소되었습니다.' ||
                error.message === 'User clicked stop button' ||
                (error instanceof Error && error.message.includes('abort'))) {
                return;
            }
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3019', '메시지 재생성 중 오류가 발생했습니다', error);
            } else if (typeof showToast === 'function') {
                showToast(`재생성 중 오류가 발생했습니다: ${error.message}`, 'error');
            } else {
                alert(`재생성 중 오류가 발생했습니다: ${error.message}`);
            }
        } finally {
            // 생성 완료 또는 중단 시 상태 초기화 (generateAIResponse의 finally가 실행되지만 이중 안전장치)
            // 주의: generateAIResponse의 finally에서도 상태 해제를 하지만, 여기서도 확실히 해제
            // 상태가 아직 해제되지 않았다면 강제로 해제
            if (this.isGenerating || this.abortController) {
                // UI 상태 업데이트를 먼저 실행 (동기적으로 즉시 반영)
                this.abortController = null;
                this.isGenerating = false;
                this.updateSendButtonIcon('play');
                this.updateAutofillButtonState();
                this.updateSendButtonState();
                
                // AI 로더 숨김 (비동기로 실행)
                this.showAILoader(false, false).catch((error) => {
                    console.debug('[regenerateMessage] showAILoader 중 오류 (무시):', error);
                });
            }
        }
    }
    
    /**
     * 삭제 확인 다이얼로그 표시
     * @returns {Promise<'swipe'|'message'|'cancel'>} 사용자 선택
     */
    showDeleteConfirmDialog() {
        // 기존 다이얼로그가 있으면 먼저 제거 (중복 방지)
        const existingDialog = document.querySelector('.delete-confirm-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        return new Promise((resolve) => {
            let isResolved = false; // 이미 resolve되었는지 추적
            
            // resolve 함수 래핑 (중복 호출 방지)
            const safeResolve = (result) => {
                if (!isResolved) {
                    isResolved = true;
                    resolve(result);
                } else {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_CHAT_20028', '삭제 확인 다이얼로그 resolve 이미 호출됨');
                    }
                }
            };
            
            // 다이얼로그 컨테이너 생성
            const dialog = document.createElement('div');
            dialog.className = 'delete-confirm-dialog';
            // 초기 상태: 숨김 (애니메이션 트리거를 위해)
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                pointer-events: auto;
            `;
            
            const content = document.createElement('div');
            content.className = 'delete-confirm-content';
            content.style.cssText = `
                background: var(--bg-secondary);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-xl);
                max-width: 400px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            `;
            
            const title = document.createElement('h3');
            title.textContent = '삭제 방법 선택';
            title.style.cssText = `
                margin: 0 0 var(--spacing-md) 0;
                color: var(--text-primary);
                font-size: 18px;
            `;
            
            const message = document.createElement('p');
            message.textContent = '현재 스와이프만 삭제할까요, 아니면 메시지 전체를 삭제할까요?';
            message.style.cssText = `
                margin: 0 0 var(--spacing-lg) 0;
                color: var(--text-secondary);
                font-size: 14px;
            `;
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: var(--spacing-md);
                justify-content: flex-end;
            `;
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '취소';
            cancelBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: var(--border-radius-md);
                color: var(--text-secondary);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                cancelBtn.style.color = 'var(--text-primary)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                cancelBtn.style.color = 'var(--text-secondary)';
            });
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeDeleteDialog(dialog, safeResolve, 'cancel');
            });
            
            const swipeDeleteBtn = document.createElement('button');
            swipeDeleteBtn.textContent = '스와이프만 삭제';
            swipeDeleteBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: var(--border-radius-md);
                color: var(--text-secondary);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            swipeDeleteBtn.addEventListener('mouseenter', () => {
                swipeDeleteBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                swipeDeleteBtn.style.color = 'var(--text-primary)';
            });
            swipeDeleteBtn.addEventListener('mouseleave', () => {
                swipeDeleteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                swipeDeleteBtn.style.color = 'var(--text-secondary)';
            });
            swipeDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeDeleteDialog(dialog, safeResolve, 'swipe');
            });
            
            const messageDeleteBtn = document.createElement('button');
            messageDeleteBtn.textContent = '메시지 전체 삭제';
            messageDeleteBtn.style.cssText = `
                padding: var(--spacing-sm) var(--spacing-lg);
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                color: #f87171;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            messageDeleteBtn.addEventListener('mouseenter', () => {
                messageDeleteBtn.style.background = 'rgba(239, 68, 68, 0.25)';
                messageDeleteBtn.style.color = '#fca5a5';
            });
            messageDeleteBtn.addEventListener('mouseleave', () => {
                messageDeleteBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                messageDeleteBtn.style.color = '#f87171';
            });
            messageDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeDeleteDialog(dialog, safeResolve, 'message');
            });
            
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(swipeDeleteBtn);
            buttonContainer.appendChild(messageDeleteBtn);
            
            content.appendChild(title);
            content.appendChild(message);
            content.appendChild(buttonContainer);
            dialog.appendChild(content);
            
            // 배경 클릭 시 취소
            const handleBackgroundClick = (e) => {
                // 컨텐츠 영역을 클릭한 경우 무시
                if (content.contains(e.target)) {
                    return;
                }
                // 배경을 클릭한 경우에만 취소
                if (e.target === dialog) {
                    this.closeDeleteDialog(dialog, safeResolve, 'cancel');
                }
            };
            
            dialog.addEventListener('click', handleBackgroundClick);
            
            document.body.appendChild(dialog);
            
            // requestAnimationFrame을 사용하여 애니메이션 트리거
            // DOM에 추가된 후 다음 프레임에서 애니메이션 시작
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // 인라인 opacity 제거하고 opening 클래스 추가하여 애니메이션 트리거
                    dialog.style.opacity = '';
                    dialog.classList.add('opening');
                });
            });
            
            // 안전장치: 일정 시간(5초) 후에도 resolve되지 않으면 자동으로 취소
            // (이론적으로는 발생하지 않아야 하지만, 버그 방지용)
            const safetyTimeout = setTimeout(() => {
                if (!isResolved) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_CHAT_20029', '삭제 확인 다이얼로그 타임아웃');
                    }
                    safeResolve('cancel');
                }
            }, 5000);
            
            // 다이얼로그가 제거되면 타임아웃도 정리
            const originalSafeResolve = safeResolve;
            dialog._safetyTimeout = safetyTimeout;
        });
    }
    
    /**
     * 삭제 다이얼로그 닫기 (애니메이션 포함)
     * @param {HTMLElement} dialog - 다이얼로그 요소
     * @param {Function} resolve - Promise resolve 함수
     * @param {string} result - 선택 결과
     */
    closeDeleteDialog(dialog, resolve, result) {
        // 다이얼로그가 DOM에 없으면 이미 제거된 것
        if (!dialog || !dialog.parentNode) {
            resolve(result); // 그래도 resolve는 호출 (안전장치)
            return;
        }
        
        // 이미 닫히는 중이면 resolve만 호출하고 return (중복 호출 방지하되 resolve는 반드시 실행)
        if (dialog.classList.contains('closing')) {
            resolve(result); // 중복 호출이어도 resolve는 반드시 실행
            return;
        }
        
        // opening 클래스 제거
        dialog.classList.remove('opening');
        dialog.classList.add('closing');
        
        // 즉시 클릭 방지
        dialog.style.pointerEvents = 'none';
        
        // 즉시 resolve 호출 (애니메이션과 관계없이 바로 진행)
        // 애니메이션은 시각적 효과일 뿐이고, 실제 삭제 로직은 즉시 진행되어야 함
        resolve(result);
        
        // 안전장치 타임아웃 정리
        if (dialog._safetyTimeout) {
            clearTimeout(dialog._safetyTimeout);
            delete dialog._safetyTimeout;
        }
        
        // 정리 함수 (다이얼로그 제거만 수행, resolve는 이미 호출됨)
        const cleanup = () => {
            if (dialog.parentNode) {
                dialog.remove();
            }
        };
        
        // 애니메이션 완료 후 제거
        let animationHandled = false;
        let timeoutId = null;
        
        const handleAnimationEnd = (e) => {
            if (e.target === dialog && !animationHandled) {
                animationHandled = true;
                dialog.removeEventListener('animationend', handleAnimationEnd);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                cleanup();
            }
        };
        
        // 다이얼로그는 애니메이션 완료 후 제거 (시각적 완성)
        // 애니메이션이 트리거되지 않는 경우를 대비한 타임아웃 (최대 300ms 후 강제 정리)
        timeoutId = setTimeout(() => {
            if (dialog.parentNode && !animationHandled) {
                animationHandled = true;
                dialog.removeEventListener('animationend', handleAnimationEnd);
                if (dialog.parentNode) {
                    dialog.remove();
                }
            }
        }, 300);
        
        dialog.addEventListener('animationend', handleAnimationEnd);
        
        // 타임아웃도 정리할 수 있도록 저장
        dialog._closeTimeout = timeoutId;
    }
    
    /**
     * 스와이프 삭제
     * @param {HTMLElement} messageWrapper - 메시지 래퍼 요소
     * @param {number} swipeIndex - 삭제할 스와이프 인덱스
     */
    async deleteSwipe(messageWrapper, swipeIndex) {
        const swipesData = messageWrapper.dataset.swipes;
        if (!swipesData) return;
        
        const swipes = JSON.parse(swipesData);
        
        // 스와이프가 1개만 있으면 삭제 불가
        if (swipes.length <= 1) {
            showToast('마지막 스와이프는 삭제할 수 없습니다. 메시지를 삭제하세요.', 'warning');
            return;
        }
        
        // 범위 체크
        if (swipeIndex < 0 || swipeIndex >= swipes.length) {
            return;
        }
        
        // this.chat 배열 업데이트 (스와이프 삭제 반영)
        const messageUuid = messageWrapper.dataset.messageUuid;
        if (messageUuid && this.chat) {
            const messageIndex = this.chat.findIndex(msg => msg.uuid === messageUuid);
            if (messageIndex !== -1 && this.chat[messageIndex].swipes && Array.isArray(this.chat[messageIndex].swipes)) {
                // this.chat 배열에서도 스와이프 삭제
                this.chat[messageIndex].swipes.splice(swipeIndex, 1);
                console.debug('[ChatManager.deleteSwipe] this.chat 배열에서 스와이프 제거:', messageUuid.substring(0, 8), swipeIndex);
            }
        }
        
        // 스와이프 삭제
        swipes.splice(swipeIndex, 1);
        
        // 삭제 후 인덱스 조정 (마지막 항목이 삭제된 경우 이전 항목으로)
        let newIndex = Math.min(swipeIndex, swipes.length - 1);
        
        // 데이터 업데이트
        messageWrapper.dataset.swipes = JSON.stringify(swipes);
        messageWrapper.dataset.swipeIndex = newIndex.toString();
        
        // 원본 텍스트 업데이트
        messageWrapper.dataset.originalText = swipes[newIndex];
        
        // this.chat 배열의 메시지 내용도 업데이트 (현재 스와이프로)
        if (messageUuid && this.chat) {
            const messageIndex = this.chat.findIndex(msg => msg.uuid === messageUuid);
            if (messageIndex !== -1 && swipes[newIndex]) {
                this.chat[messageIndex].mes = swipes[newIndex];
            }
        }
        
        // 스와이프 텍스트에 정규식 적용 (AI 출력)
        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
        // 실리태번과 동일: 스와이프 시에도 정규식 적용 (isMarkdown: true)
        const chatMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        const wrapperIndex = Array.from(chatMessages).indexOf(messageWrapper);
        const usableMessages = Array.from(chatMessages).filter(w => {
            const role = w.dataset.role;
            return role === 'user' || role === 'assistant';
        });
        const messageIndex = Array.from(usableMessages).indexOf(messageWrapper);
        const depth = messageIndex !== -1 ? usableMessages.length - messageIndex - 1 : undefined;
        
        // 실리태번과 동일: 스와이프 시에도 characterOverride 전달
        const characterName = messageWrapper.dataset.characterName || undefined;
        const processedSwipeText = await getRegexedString(swipes[newIndex], REGEX_PLACEMENT.AI_OUTPUT, {
            characterOverride: characterName,
            isMarkdown: true,
            isPrompt: false,
            depth: depth
        });
        
        // {{user}}, {{char}} 매크로 치환 적용
        // substituteParams - 전역 스코프에서 사용
        let userName = '';
        try {
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            if (currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentPersonaId);
                if (persona?.name) {
                    userName = persona.name;
                }
            }
        } catch (error) {
            // 무시
        }
        const processedSwipeTextWithMacros = substituteParams(processedSwipeText, userName, characterName || '');
        
        // 메시지 텍스트 업데이트
        const messageText = messageWrapper.querySelector('.message-text');
        const content = messageWrapper.querySelector('.message-content');
        if (messageText) {
            messageText.innerHTML = messageFormatting(processedSwipeTextWithMacros, userName, characterName || '');
            this.renderHtmlIframesInElement(messageText);
        }
        
        // 스와이프 버튼 상태 업데이트
        const swipeControls = messageWrapper.querySelector('.message-swipe-controls');
        if (swipeControls) {
            const swipeLeftBtn = swipeControls.querySelector('.swipe-left');
            const swipeRightBtn = swipeControls.querySelector('.swipe-right');
            const swipeIndicator = swipeControls.querySelector('.swipe-indicator');
            
            if (swipeLeftBtn) swipeLeftBtn.disabled = newIndex === 0;
            if (swipeRightBtn) swipeRightBtn.disabled = false;
            if (swipeIndicator) swipeIndicator.textContent = `${newIndex + 1}/${swipes.length}`;
        }
        
        // 채팅 저장 (스와이프 삭제 즉시 반영 - 디바운스 없이 바로 저장)
        // DOM 업데이트 완료 대기
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await this.saveChat();
        
        // 애니메이션 효과
        if (messageText) {
            messageText.style.opacity = '0';
            setTimeout(() => {
                messageText.style.transition = 'opacity 0.2s ease-in';
                messageText.style.opacity = '1';
            }, 10);
        }
    }
    
    /**
     * 채팅 액션 처리
     * @param {string} action - 액션 타입 (select, export, delete)
     * @param {string} id - 채팅 ID
     */
    async handleChatAction(action, id) {
        // ChatStorage - 전역 스코프에서 사용
        
        switch (action) {
            case 'select':
                // 실리태번과 동일: 채팅 로드 및 표시
                await this.loadChat(id);
                
                // ⚠️ 중요: loadChat 후에 this.currentCharacterId 설정
                // loadChat에서는 this.currentCharacterId를 설정하지 않으므로 여기서 설정
                // 채팅 데이터에서 characterId 가져오기
                const selectedChatData = await ChatStorage.load(id);
                if (selectedChatData && selectedChatData.characterId) {
                    this.currentCharacterId = selectedChatData.characterId;
                }
                
                // 패널 닫기 (외부에서 호출 시)
                const panelContainer = document.getElementById('panel-modal-container');
                if (panelContainer) {
                    // PanelManager - 전역 스코프에서 사용
                    // PanelManager 인스턴스 찾기 (window에 저장되어 있을 수 있음)
                    if (window.panelManager) {
                        window.panelManager.closePanelModal();
                    } else {
                        // 직접 닫기
                        panelContainer.remove();
                        const overlay = document.getElementById('overlay');
                        if (overlay && !overlay.classList.contains('hidden')) {
                            overlay.classList.add('hidden');
                        }
                    }
                }
                break;
            case 'export':
                // 채팅 내보내기 (실리태번 JSONL 형식)
                await this.exportChat(id);
                break;
            case 'edit-title':
                // 채팅 제목 편집
                const chatData = await ChatStorage.load(id);
                if (!chatData) {
                    showToast('채팅을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const currentTitle = chatData.chatName || chatData.metadata?.chat_name || id;
                const newTitle = await showInputModal('채팅 제목을 입력하세요:', '채팅 제목 편집', currentTitle);
                
                if (newTitle && newTitle.trim() !== '' && newTitle !== currentTitle) {
                    try {
                        // 채팅 제목 업데이트
                        chatData.chatName = newTitle.trim();
                        await ChatStorage.save(id, chatData);
                        
                        // 현재 채팅이면 현재 채팅 이름도 업데이트
                        if (this.currentChatId === id) {
                            this.currentChatName = newTitle.trim();
                        }
                        
                        // 캐릭터의 현재 채팅 정보도 업데이트
                        if (chatData.characterId) {
                            // CharacterStorage - 전역 스코프에서 사용
                            const character = await CharacterStorage.load(chatData.characterId);
                            if (character && character.chat === currentTitle) {
                                character.chat = newTitle.trim();
                                await CharacterStorage.save(chatData.characterId, character);
                            }
                        }
                        
                        // 채팅 목록 패널 새로고침
                        if (window.panelManager) {
                            const currentCharId = await CharacterStorage.loadCurrent();
                            if (currentCharId) {
                                window.panelManager.refreshChatListPanel(currentCharId).catch(error => {
                                    console.debug('[ChatManager.handleChatAction] 채팅 목록 패널 새로고침 오류:', error);
                                });
                            }
                            }
                        } catch (error) {
                            // 오류 코드 토스트 알림 표시
                            if (typeof showErrorCodeToast === 'function') {
                                showErrorCodeToast('ERR_CHAT_3020', '채팅 제목 편집 오류', error);
                            } else if (typeof showToast === 'function') {
                                showToast('채팅 제목 수정 중 오류가 발생했습니다.', 'error');
                            }
                        }
                }
                break;
            case 'delete':
                // 실리태번과 동일: 확인 후 삭제
                const confirmed = await showConfirmModal('이 채팅을 삭제하시겠습니까?', '채팅 삭제', { confirmType: 'danger' });
                if (confirmed) {
                    try {
                        const wasCurrentChat = this.currentChatId === id;
                        await ChatStorage.delete(id);
                        
                        // 규칙 1-3: 현재 채팅이 삭제된 경우 처리
                        if (wasCurrentChat) {
                            this.currentChatId = null;
                            this.currentChatName = null;
                            this.elements.chatMessages.innerHTML = '';
                            
                            // CharacterStorage - 전역 스코프에서 사용
                            const currentCharId = await CharacterStorage.loadCurrent();
                            
                            if (currentCharId) {
                                const allChats = await ChatStorage.loadAll();
                                const character = await CharacterStorage.load(currentCharId);
                                
                                if (character) {
                                    const characterName = character?.data?.name || character?.name || 'Unknown';
                                    
                                    // 해당 캐릭터의 모든 채팅 필터링 (삭제된 채팅 제외)
                                    const characterChats = Object.entries(allChats)
                                        .filter(([chatId, chatData]) => {
                                            // 삭제된 채팅은 제외
                                            if (chatId === id) return false;
                                            
                                            // characterId로 확인 (가장 정확)
                                            if (chatData.characterId === currentCharId) {
                                                return true;
                                            }
                                            // characterName으로 확인 (fallback)
                                            if (chatData.character_name === characterName || 
                                                chatData.metadata?.character_name === characterName) {
                                                return true;
                                            }
                                            return false;
                                        })
                                        .map(([chatId, chatData]) => {
                                            const messageCount = chatData.messages?.length || 0;
                                            const hasMessages = messageCount > 0;
                                            
                                            // lastMessageDate 계산: 메시지가 있으면 마지막 메시지 날짜, 없으면 생성 날짜 사용
                                            let lastMessageDate = 0;
                                            if (hasMessages) {
                                                if (chatData.lastMessageDate) {
                                                    lastMessageDate = chatData.lastMessageDate;
                                                } else if (chatData.messages && chatData.messages.length > 0) {
                                                    const lastMessage = chatData.messages[chatData.messages.length - 1];
                                                    // 실리태번 형식: send_date 우선 사용
                                                    lastMessageDate = lastMessage.send_date || 
                                                                     lastMessage.date || 
                                                                     lastMessage.timestamp || 
                                                                     chatData.metadata?.create_date || 
                                                                     0;
                                                }
                                            } else {
                                                // 메시지가 0개인 채팅도 채팅으로 인정하므로, 생성 날짜를 사용
                                                // create_date가 없으면 fallback으로 현재 시간 사용
                                                lastMessageDate = chatData.metadata?.create_date || 
                                                                 chatData.create_date || 
                                                                 (chatData.metadata?.chat_metadata?.create_date) ||
                                                                 Date.now(); // 날짜가 없어도 채팅으로 인정
                                            }
                                            
                                            return {
                                                chatId,
                                                chatData,
                                                lastMessageDate,
                                                messageCount,
                                                hasMessages
                                            };
                                        })
                                        // 규칙 4: 0개 메시지 채팅도 채팅으로 인정하므로, lastMessageDate 필터 제거
                                        // .filter(item => item.lastMessageDate > 0) 제거 - 모든 채팅 포함
                                        .sort((a, b) => b.lastMessageDate - a.lastMessageDate); // 최신순 정렬
                                    
                                    // 채팅 목록 모달이 열려있으면 먼저 새로고침 (삭제 반영)
                                            if (window.panelManager) {
                                        window.panelManager.refreshChatListPanel(currentCharId).catch(error => {
                                            console.debug('[ChatManager.handleChatAction] 채팅 목록 패널 새로고침 오류 (삭제 후):', error);
                                        });
                                    }
                                    
                                    // 규칙 2: 가장 최근 채팅으로 전환 또는 규칙 3: 다른 채팅이 없으면 새 채팅 생성
                                    if (characterChats.length > 0) {
                                        const mostRecentChat = characterChats[0];
                                        // ⚠️ [실리태번 방식으로 변경] 불러온 채팅도 일반 채팅처럼 취급하므로 특별 처리 불필요
                                        // 실리태번은 불러온 채팅에 특별한 플래그를 추가하지 않으며, chat.length === 0 조건만으로 그리팅 추가 여부를 결정합니다.
                                        // 기존 코드 (주석 처리):
                                        // const isImported = mostRecentChat.chatData.metadata?.isImported === true;
                                        // const isEmptyChat = isImported ? false : (mostRecentChat.messageCount === 0);
                                        // 실리태번 방식: messageCount만 확인
                                        const isEmptyChat = mostRecentChat.messageCount === 0;
                                        await this.loadChat(mostRecentChat.chatId, isEmptyChat);
                                        
                                        // ⚠️ 중요: loadChat 후에 this.currentCharacterId 설정
                                        // loadChat에서는 this.currentCharacterId를 설정하지 않으므로 여기서 설정
                                        this.currentCharacterId = currentCharId;
                                        
                                        // 캐릭터의 현재 채팅 정보 업데이트
                                        character.chat = mostRecentChat.chatData.chatName;
                                        await CharacterStorage.save(currentCharId, character);
                                    } else {
                                        // 모든 채팅이 삭제된 경우: character.chat 필드 초기화 후 새 채팅 생성
                                        character.chat = null;
                                        await CharacterStorage.save(currentCharId, character);
                                        
                                        // 규칙 3: 다른 채팅이 없으면 새 채팅 생성
                                        await this.createNewChat(currentCharId);
                                        
                                        // 새 채팅 생성 후 채팅 목록 다시 새로고침 (생성 반영)
                                                if (window.panelManager) {
                                            window.panelManager.refreshChatListPanel(currentCharId).catch(error => {
                                                console.debug('[ChatManager.handleChatAction] 채팅 목록 패널 새로고침 오류 (새 채팅 후):', error);
                                            });
                                        }
                                    }
                                    
                                    // 채팅 목록 모달은 열어둠 (사용자가 직접 닫을 때까지)
                                }
                            }
                        } else {
                            // 현재 채팅이 아닌 경우에는 패널만 새로고침
                            const currentCharId = await CharacterStorage.loadCurrent();
                            if (currentCharId && window.panelManager) {
                                window.panelManager.refreshChatListPanel(currentCharId).catch(error => {
                                    console.debug('[ChatManager.handleChatAction] 채팅 목록 패널 새로고침 오류 (다른 채팅 삭제 후):', error);
                                });
                            }
                        }
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_CHAT_3024', '채팅 삭제 중 오류가 발생했습니다', error);
                        } else if (typeof showToast === 'function') {
                            showToast('채팅 삭제 중 오류가 발생했습니다.', 'error');
                        }
                    }
                }
                break;
        }
    }
    
    /**
     * 채팅 내보내기 (실리태번 JSONL 형식)
     * 실리태번의 saveChat과 동일한 형식으로 내보내기
     * @param {string} chatId - 내보낼 채팅 ID
     */
    async exportChat(chatId) {
        try {
            // 채팅 데이터 로드
            const chatData = await ChatStorage.load(chatId);
            if (!chatData) {
                showToast('채팅을 찾을 수 없습니다.', 'error');
                return;
            }
            
            // 실리태번과 동일: chat 배열 사용 (메시지)
            // loadChat에서 이미 this.chat에 메시지가 저장되어 있으면 사용, 아니면 저장소에서 가져오기
            let messages = [];
            if (this.currentChatId === chatId && this.chat && this.chat.length > 0) {
                // 현재 로드된 채팅이면 this.chat 사용 (실리태번과 동일)
                messages = [...this.chat];
            } else {
                // 저장소에서 메시지 가져오기
                messages = (chatData.messages || []).sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
            }
            
            // 캐릭터 정보 가져오기
            let characterName = chatData.metadata?.character_name || 'Character';
            let userName = chatData.metadata?.user_name || 'User';
            
            if (chatData.characterId) {
                const character = await CharacterStorage.load(chatData.characterId);
                if (character) {
                    characterName = character?.data?.name || character?.name || characterName;
                }
            }
            
            // 페르소나 정보 가져오기
            const settings = await SettingsStorage.load();
            if (settings.currentPersonaId) {
                const persona = await UserPersonaStorage.load(settings.currentPersonaId);
                if (persona && persona.name) {
                    userName = persona.name;
                }
            }
            
            // 실리태번과 동일: chatToSave 형식으로 구성
            // saveChat에서 사용하는 형식: [{ 헤더 }, ...trimmedChat]
            // create_date는 chat_create_date 또는 metadata.create_date 사용
            const createDate = chatData.metadata?.create_date || this.chatCreateDate || humanizedISO8601DateTime();
            
            // 실리태번과 동일: 헤더 구성
            const header = {
                user_name: userName,
                character_name: characterName,
                create_date: createDate,
                chat_metadata: chatData.metadata?.chat_metadata || {},
            };
            
            // 실리태번과 동일: chatToSave = [{ 헤더 }, ...trimmedChat]
            // trimmedChat은 chat 배열 (mesId가 있으면 chat.slice(0, mesId + 1), 없으면 chat.slice())
            // 우리는 전체 메시지를 내보내므로 messages를 그대로 사용
            const chatToSave = [
                header,
                ...messages
            ];
            
            // 실리태번과 동일: JSONL 형식으로 변환
            // chatData.map(JSON.stringify).join('\n')
            const jsonlContent = chatToSave.map(obj => JSON.stringify(obj)).join('\n');
            
            // 파일명 생성 (실리태번 형식)
            // 실리태번: fileName = `${String(request.body.file_name)}.jsonl`
            // 하지만 우리는 사용자가 다운로드하므로 이름 생성
            const sanitizedCharName = characterName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || 'Chat';
            const createDateStr = typeof createDate === 'string' 
                ? createDate.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()
                : humanizedISO8601DateTime(createDate).replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
            const fileName = `${sanitizedCharName} - ${createDateStr}.jsonl`;
            
            // Blob 생성 및 다운로드
            const blob = new Blob([jsonlContent], { type: 'application/json' });
            
            // downloadBlob - 전역 스코프에서 사용
            const success = await downloadBlob(blob, fileName);
            
            if (success && typeof showToast === 'function') {
                showToast(`채팅 내보내기 완료: ${fileName}`, 'success');
            }
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_CHAT_3025', '채팅 내보내기 오류', error);
            } else if (typeof showToast === 'function') {
                showToast(`채팅 내보내기 실패: ${error.message}`, 'error');
            }
        }
    }
}

// 전역 스코프에 노출
window.ChatManager = ChatManager;
