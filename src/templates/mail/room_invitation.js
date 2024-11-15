"use strict";

module.exports = {
    subject: (data) => `社群的 ${data.userName} 邀請您成為 ${data.roomName} 的管理員`,
    text: (data) => `
        您好 這裡是 Freya 芙蕾雅，一個專注為 LINE 社群打擊垃圾訊息的平台。
        使用者 ${data.userName} 邀請您成為 ${data.roomName} 的管理員。

        請點擊以下網址接受邀請：
        ${data.invitationUrl}

        此邀請網址將於 24 小時內過期，請盡快接受邀請。
        若您並未參與此社群，請您無視本電子郵件。

        本電子郵件由系統自動發送，請勿回覆。

        「Freya 芙蕾雅」是一個是 LINE 社群加入申請驗證平台，以打擊垃圾訊息為作為使命。
        由臺灣網際網路技術推廣組織（https://web-tech.tw）提供技術支援。
    `,
    html: (data) => `
        <p>
            您好 這裡是 Freya 芙蕾雅，<br/>
            使用者 ${data.userName} 邀請您成為 ${data.roomName} 的管理員。
        </p>
        <p>
            請點擊以下網址接受邀請：<br/>
            <a href="${data.invitationUrl}">
                ${data.invitationUrl}
            </a>
        <p>
        <p>
            此邀請網址將於 24 小時內過期，請盡快接受邀請。<br/>
            若您並未參與此社群，請您無視本電子郵件。
        <p>
        <p>
            本電子郵件由系統自動發送，請勿回覆。
        <p>
        <p>
            「Freya 芙蕾雅」是一個是 LINE 社群加入申請驗證平台，以打擊垃圾訊息為作為使命。<br/>
            由 <a href="https://web-tech.tw">臺灣網際網路技術推廣組織</a> 提供技術支援。
        </p>
    `,
};
