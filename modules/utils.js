/**
 * 유틸리티 함수들
 */

/**
 * humanizedDateTime 함수
 * 실리태번의 RossAscends-mods.js humanizedDateTime 함수와 동일
 * @returns {string} YYYY-MM-DD@HHhMMmSSs 형식의 날짜 문자열
 * @example "2024-01-15@14h30m45s"
 */
function humanizedDateTime() {
    const now = new Date(Date.now());
    const dt = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
    };
    
    for (const key in dt) {
        dt[key] = dt[key].toString().padStart(2, '0');
    }
    
    return `${dt.year}-${dt.month}-${dt.day}@${dt.hour}h${dt.minute}m${dt.second}s`;
}

/**
 * HTML 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * getMessageTimeStamp 함수 (실리태번의 RossAscends-mods.js와 동일)
 * 타임스탬프를 "October 27, 2025 8:04pm" 형식으로 변환
 * @param {number} [timestamp] - 타임스탬프 (밀리초), 없으면 현재 시간
 * @returns {string} "October 27, 2025 8:04pm" 형식의 날짜 문자열
 */
function getMessageTimeStamp(timestamp = Date.now()) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(timestamp);
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = ('0' + d.getMinutes()).slice(-2);
    let meridiem = 'am';
    if (hours >= 12) {
        meridiem = 'pm';
        hours -= 12;
    }
    if (hours === 0) {
        hours = 12;
    }
    const formattedDate = month + ' ' + day + ', ' + year + ' ' + hours + ':' + minutes + meridiem;
    return formattedDate;
}

/**
 * humanizedISO8601DateTime 함수 (실리태번의 util.js와 동일)
 * 타임스탬프를 "2025-10-27 @20h 04m 52s 123ms" 형식으로 변환
 * @param {number|Date} [date] - 타임스탬프 또는 Date 객체, 없으면 현재 시간
 * @returns {string} "2025-10-27 @20h 04m 52s 123ms" 형식의 날짜 문자열
 */
function humanizedISO8601DateTime(date = Date.now()) {
    const baseDate = typeof date === 'number' ? new Date(date) : date instanceof Date ? date : new Date();
    const humanYear = baseDate.getFullYear();
    const humanMonth = (baseDate.getMonth() + 1);
    const humanDate = baseDate.getDate();
    const humanHour = (baseDate.getHours() < 10 ? '0' : '') + baseDate.getHours();
    const humanMinute = (baseDate.getMinutes() < 10 ? '0' : '') + baseDate.getMinutes();
    const humanSecond = (baseDate.getSeconds() < 10 ? '0' : '') + baseDate.getSeconds();
    const humanMillisecond = (baseDate.getMilliseconds() < 10 ? '0' : '') + baseDate.getMilliseconds();
    const HumanizedDateTime = (humanYear + '-' + humanMonth + '-' + humanDate + ' @' + humanHour + 'h ' + humanMinute + 'm ' + humanSecond + 's ' + humanMillisecond + 'ms');
    return HumanizedDateTime;
}

