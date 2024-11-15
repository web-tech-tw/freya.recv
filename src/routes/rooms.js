"use strict";

const {createHmac} = require("node:crypto");

const {StatusCodes} = require("http-status-codes");
const {getMust} = require("../config");

const {useApp, withAwait, express} = require("../init/express");
const {useCache} = require("../init/cache");

const middlewareAccess = require("../middleware/access");
const middlewareValidator = require("express-validator");
const middlewareInspector = require("../middleware/inspector");
const middlewareRestrictor = require("../middleware/restrictor");

const utilOpenchat = require("../utils/openchat");
const utilMailSender = require("../utils/mail_sender");

const shortid = require("shortid");

const Room = require("../models/room");
const Submission = require("../models/submission");

// Read config
const inteHost = getMust("FREYA_INTE_HOST");
const pairingSecret = getMust("FREYA_PAIRING_SECRET");

// Define hmac function - SHA256
const hmac256hex = (data, key) =>
    createHmac("sha256", key).update(data).digest("hex");

// Create router
const {Router: newRouter} = express;
const router = newRouter();

router.use(express.json());

router.get("/",
    middlewareAccess(null),
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Find rooms
        const rooms = await Room.find({
            administrators: {
                $in: [userId],
            },
        });

        // Send response
        res.send(rooms);
    }),
);

router.post(
    "/",
    middlewareAccess(null),
    middlewareValidator.body("url").isURL(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get page URL
        if (!utilOpenchat.isValidTicketPageUrl(req.body.url)) {
            res.
                status(StatusCodes.BAD_REQUEST).
                send({
                    error: "Invalid page URL",
                });
            return;
        }

        // Parse page URL
        const {pathname} = new URL(req.body.url);
        const pageUrl = `https://line.me/${pathname.slice(1)}`;

        // Check if the room already exists
        if (await Room.findOne({pageUrl})) {
            res.
                status(StatusCodes.CONFLICT).
                send({
                    error: "Room already exists",
                });
            return;
        }

        // Parse room data
        let roomData;
        try {
            roomData = await utilOpenchat.parseTicketPage(pageUrl);
        } catch (e) {
            res.
                status(StatusCodes.BAD_REQUEST).
                send({
                    error: e.message,
                });
            return;
        }

        // Get pairing data
        const pairingCode = shortid.generate();
        const pairingHash = hmac256hex([
            userId, pageUrl, pairingCode,
        ].join("&"), pairingSecret);

        // Send response
        res.send({
            room: roomData,
            code: pairingCode,
            hash: pairingHash,
        });
    }),
);

router.patch(
    "/",
    middlewareAccess(null),
    middlewareValidator.body("url").isURL(),
    middlewareValidator.body("code").isString().notEmpty(),
    middlewareValidator.body("hash").isString().isLength({min: 64, max: 64}),
    middlewareInspector,
    middlewareRestrictor(10, 60, false),
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get pairing data
        const pageUrl = req.body.url;
        const pairingCode = req.body.code;
        const pairingHash = req.body.hash;

        // Validate request
        const pairingHashExpected = hmac256hex([
            userId, pageUrl, pairingCode,
        ].join("&"), pairingSecret);

        if (pairingHash !== pairingHashExpected) {
            res.
                status(StatusCodes.FORBIDDEN).
                send({
                    error: "Invalid pairing hash",
                });
            return;
        }

        // Check if the room already exists
        if (await Room.findOne({pageUrl})) {
            res.
                status(StatusCodes.CONFLICT).
                send({
                    error: "Room already exists",
                });
            return;
        }

        // Parse room data
        let roomData;
        try {
            roomData = await utilOpenchat.parseTicketPage(pageUrl, true);
        } catch (e) {
            res.
                status(StatusCodes.BAD_REQUEST).
                send({
                    error: e.message,
                });
            return;
        }

        // Extract room data
        const {
            description,
        } = roomData;

        // Valid pairing code
        const isDescriptionIncluded = description.includes(pairingCode);
        if (!isDescriptionIncluded) {
            res.
                status(StatusCodes.BAD_REQUEST).
                send({
                    error: "Invalid pairing code",
                });
            return;
        }

        // Create room
        const room = new Room({
            ...roomData,
            creator: userId,
            administrators: [userId],
            code: pairingCode,
        });

        // Save room
        await room.save();

        // Send response
        res.sendStatus(StatusCodes.CREATED);
    }),
);

router.get("/:code",
    middlewareValidator.param("code").isString().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get room code
        const code = req.params.code;

        // Find room
        const room = await Room.findOne({code}).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Send response
        res.send({
            label: room.label,
            members: room.members,
            description: room.description,
            backgroundImage: room.backgroundImage,
            pageUrl: room.pageUrl,
        });
    }),
);

router.patch("/:code",
    middlewareAccess(null),
    middlewareValidator.param("code").isString().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get room code
        const code = req.params.code;

        // Find room
        const room = await Room.findOne({
            code,
            administrators: {
                $in: [userId],
            },
        }).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Update room
        const pageUrl = room.pageUrl;
        const roomUpdated = await utilOpenchat.parseTicketPage(pageUrl);

        // Handle room data
        Object.assign(room, roomUpdated);

        // Save room
        const roomData = (await room.save()).
            toObject();

        // Send response
        res.send({
            label: roomData.label,
            members: roomData.members,
            description: roomData.description,
            backgroundImage: roomData.backgroundImage,
            pageUrl: roomData.pageUrl,
        });
    }),
);

router.delete("/:code",
    middlewareAccess(null),
    middlewareValidator.param("code").isString().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get room code
        const code = req.params.code;

        // Find room
        const room = await Room.findOne({
            code,
            creator: userId,
        }).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Delete room
        await room.delete();

        // Send response
        res.sendStatus(StatusCodes.NO_CONTENT);
    }),
);

router.post("/:roomCode/administrators",
    middlewareAccess(null),
    middlewareValidator.param("roomCode").isString().notEmpty(),
    middlewareValidator.body("email").isEmail().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get request data
        const email = req.body.email.toLowerCase();
        const roomCode = req.params.roomCode;

        // Find room
        const room = await Room.findOne({
            code: roomCode,
            creator: userId,
        }).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Generate an invitation
        const invitationId = shortid.generate();
        const invitationTimestamp = Date.now();

        const invitation = {
            email,
            roomCode,
            timestamp: invitationTimestamp,
        };

        // Save invitation
        const cache = useCache();
        cache.set(`invitation:${invitationId}`, invitation, 86400);

        // Get room name
        const roomName = room.label;

        // Get user name
        const userName = req.auth.metadata.profile.nickname;

        // Get invitation URL
        const invitationUrl = `${inteHost}/#/ti/g2a/${invitationId}`;

        // Get invitation datetime
        const invitationDatetime = new Date(invitationTimestamp).toISOString();

        // Send an invitation email
        await utilMailSender("room_invitation", {
            to: email,
            userName,
            roomName,
            invitationUrl,
            invitationDatetime,
        });

        // Send response
        res.sendStatus(StatusCodes.CREATED);
    }),
);

router.patch("/invitations/:invitationId",
    middlewareAccess(null),
    middlewareValidator.param("invitationId").isString().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get user email
        const userEmail = req.auth.metadata.profile.email;

        // Get request data
        const invitationId = req.params.invitationId;

        // Fine invitation
        const cache = useCache();
        const invitation = cache.get(`invitation:${invitationId}`);
        if (!invitation) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Invitation not found",
                });
            return;
        }

        // Get room code
        const roomCode = invitation.roomCode;

        // Find room
        const room = await Room.findOne({code: roomCode}).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Check email
        if (invitation.email !== userEmail) {
            res.
                status(StatusCodes.FORBIDDEN).
                send({
                    error: "Invalid email",
                });
            return;
        }

        // Remove invitation
        cache.del(`invitation:${invitationId}`);

        // Check if the user is an administrator
        if (room.administrators.includes(userId)) {
            res.
                status(StatusCodes.CONFLICT).
                send({
                    error: "Already an administrator",
                });
            return;
        }

        // Add administrator
        room.administrators.push(userId);

        // Save room
        await room.save();

        // Send response
        res.sendStatus(StatusCodes.CREATED);
    }),
);

router.delete("/invitations/:invitationId",
    middlewareAccess(null),
    middlewareValidator.param("invitationId").isString().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get request data
        const invitationId = req.params.invitationId;

        // Fine invitation
        const cache = useCache();
        const invitation = cache.get(`invitation:${invitationId}`);
        if (!invitation) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Invitation not found",
                });
            return;
        }

        // Get room code
        const roomCode = invitation.roomCode;

        // Find room
        const room = await Room.findOne({code: roomCode}).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Check operator
        if (
            room.creator !== userId &&
            invitation.email !== req.auth.metadata.profile.email
        ) {
            res.
                status(StatusCodes.FORBIDDEN).
                send({
                    error: "Invalid operator",
                });
            return;
        }

        // Remove invitation
        cache.del(`invitation:${invitationId}`);

        // Send response
        res.sendStatus(StatusCodes.NO_CONTENT);
    }),
);

router.delete("/:roomCode/administrators/:userId",
    middlewareAccess(null),
    middlewareValidator.param("roomCode").isString().notEmpty(),
    middlewareValidator.param("userId").isMongoId().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get request data
        const userIdTarget = req.params.userId;
        const roomCode = req.params.roomCode;

        // Find room
        const room = await Room.findOne({
            code: roomCode,
            creator: userId,
            administrators: {
                $in: [userIdTarget],
            },
        }).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Check if the user is the creator
        if (room.creator === userIdTarget) {
            res.
                status(StatusCodes.FORBIDDEN).
                send({
                    error: "Creator cannot be removed",
                });
            return;
        }

        // Administrators only allowed to remove itself
        if (
            userId !== room.creator &&
            userId !== userIdTarget
        ) {
            res.
                status(StatusCodes.FORBIDDEN).
                send({
                    error: "Invalid operator",
                });
            return;
        }

        // Remove administrator
        room.administrators = room.administrators.filter(
            (administrator) => administrator !== userIdTarget,
        );

        // Save room
        await room.save();

        // Send response
        res.sendStatus(StatusCodes.NO_CONTENT);
    }),
);

router.get("/:roomCode/submissions/:code",
    middlewareAccess(null),
    middlewareValidator.param("roomCode").isString().notEmpty(),
    middlewareValidator.param("code").isString().notEmpty(),
    middlewareInspector,
    withAwait(async (req, res) => {
        // Get user ID
        const userId = req.auth.id;

        // Get room code
        const roomCode = req.params.roomCode;
        const code = req.params.code;

        // Find room
        const room = await Room.findOne({
            code: roomCode,
            administrators: {
                $in: [userId],
            },
        }).exec();
        if (!room) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Room not found",
                });
            return;
        }

        // Find submission
        const submission = await Submission.findOne({
            roomCode,
            code,
        }).exec();

        // Check if submission exists
        if (!submission) {
            res.
                status(StatusCodes.NOT_FOUND).
                send({
                    error: "Submission not found",
                });
            return;
        }

        // Send response
        res.send(submission);
    }),
);

// Export routes mapper (function)
module.exports = () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/rooms", router);
};
