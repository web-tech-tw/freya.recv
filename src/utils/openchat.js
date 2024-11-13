"use strict";
// The toolbox for LINE OpenChat

// Import modules
const {getMust} = require("../config");
const {useCache} = require("../init/cache");

const cheerio = require("cheerio");

// Read config
const userAgent = getMust("FREYA_CHEERIO_USER_AGENT");

// Define the page fetcher
const fetchPage = async (pageUrl, options = {}) => {
    const cache = useCache();
    if (cache.has(pageUrl) && !options.isFlush) {
        return cache.get(pageUrl);
    }

    const $ = cheerio.fromURL(pageUrl, {
        requestOptions: {
            headers: {"user-agent": userAgent},
            ...options,
        },
    });
    cache.set(pageUrl, $);
    return $;
};

/**
 * Check if the URL is a valid LINE OpenChat URL.
 * @param {string} pageUrl - The URL to check.
 * @return {boolean} - The result.
 */
function isValidTicketPageUrl(pageUrl) {
    const validPrefixes = [
        "https://line.me/ti/g2/",
        "https://line.me/R/ti/g2/",
        "https://line.naver.jp/ti/g2/",
        "https://line.naver.jp/R/ti/g2/",
    ];
    return validPrefixes.some(
        (prefix) => pageUrl.startsWith(prefix),
    );
}

/**
 * Parse the ticket page of LINE OpenChat (LINE Group v2).
 * @param {string} pageUrl - The URL of the ticket page.
 * @param {boolean} isFlush - Flush the cache or not.
 * @return {Promise<Object>} - The parsed data.
 */
async function parseTicketPage(pageUrl, isFlush = false) {
    // Check the URL
    if (!isValidTicketPageUrl(pageUrl)) {
        throw new Error("invalid page url");
    }

    // Fetch the page
    const $ = await fetchPage(pageUrl, {isFlush});
    const texts = $("*[class$='Txt']");

    // Check the page structure via texts
    if (texts.length < 2) {
        throw new Error("invalid page structure");
    }

    // Required fields
    const label = texts.eq(0).text();
    const members = parseInt(texts.eq(1).text().
        replace(/[^0-9]/g, "") || -1, 10,
    );

    // Check the required fields
    if (members < 1) {
        throw new Error("invalid member count");
    }

    // Optional fields
    const description = $("*[class$='Desc']").text() || "";
    const inners = $("*[class$='Inner']");
    const backgroundImage = inners.eq(0).
        css("background-image")?.
        replace(/url\((.*)\)/, "$1") || "";

    // Return the parsed data
    return {
        label,
        members,
        description,
        backgroundImage,
    };
}

module.exports = {
    isValidTicketPageUrl,
    parseTicketPage,
};
