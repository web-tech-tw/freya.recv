"use strict";
// The toolbox for the Turnstile

const {
    isProduction,
} = require("../config");

const axios = require("axios");

/**
 * Check if the response is valid.
 * @param {string} turnstileToken - The response token.
 * @param {string} turnstileSecret - The secret key.
 * @param {string} ipAddress - The IP address of the client.
 * @return {Promise<Object>} - The result.
 */
async function validResponse(turnstileToken, turnstileSecret, ipAddress) {
    if (!isProduction()) {
        return {
            success: true,
        };
    }

    const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    try {
        const result = await axios.post(url, {
            response: turnstileToken,
            secret: turnstileSecret,
            remoteip: ipAddress,
        });
        return result.data;
    } catch (e) {
        return {
            success: false,
            ...e,
        };
    }
}

module.exports = {
    validResponse,
};
