const mongoose = require("mongoose");

const Chat = mongoose.Schema({
    Messages: [
        {
            message: {
                type: String,
                required: true
            },
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    Timestamp: {
        type: Date,
        default: Date.now
    },
    ChatId: {
        type: String,
        required: true
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
});

const ChatModel = mongoose.model("Chat", Chat);
module.exports = ChatModel;