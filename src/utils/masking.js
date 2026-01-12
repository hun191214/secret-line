"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskUserName = maskUserName;
// Privacy masking utility
function maskUserName(name, type = 'gold') {
    if (!name)
        return '';
    const prefix = type === 'gold' ? 'Gold_' : 'User_';
    // 마지막 3글자만 남기고 마스킹
    const tail = name.length > 3 ? name.slice(-3) : name;
    return `${prefix}${tail}`;
}
//# sourceMappingURL=masking.js.map