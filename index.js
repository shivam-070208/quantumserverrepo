const express = require('express');
const { Server } = require('socket.io');
const { createServer } = require('node:http');
const app = express();
const cors = require('cors');
const UserModel = require('./mongoDB/models/Usermodel')
const ChatModel = require('./mongoDB/models/Chat')






// Creating server
const httpServer = createServer(app);
const io = new Server(httpServer);

const connectDB = require('./mongoDB/connect');

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-requested-with']
}));


const cookieParser = require('cookie-parser');




app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        res.status(504).send('Request Timeout');
    });
    next();
});


// Importing routes
const user = require('./Routes/user');
const { Socket } = require('node:dgram');




// Connecting to the database
connectDB().catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
});

// Setting middlewares


app.use('/', user);

//setting fuction for socket
const add = async (ParentArray, ChildOnlinearray, ChildOfflinearray) => {
    ChildOfflinearray = ParentArray.filter((user) => {
        return user.status === "Offline";

    })
    ChildOnlinearray = ParentArray.filter((user) => {
        return user.status === "Online";
    })
}

// Setting up socket connection
io.on('connection', (socket) => {
    let User;
    console.log('Connected:', socket.id);

    socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id);
        if (User) {
            User.connectedid = "";
            User.status = "Offline";
            await User.save()
        }
    });
    socket.on('user-joined', async (data) => {
        const { Email } = data;

        console.log(Email)
        User = await UserModel.findOneAndUpdate(
            { Email: Email },
            { $set: { connectedid: socket.id, status: "Online" } },
            { new: true })
        if (User) {

            const PrivateConnection = User.PrivateConnection || [];
            const RequestSend = User.RequestSend || [];
            const RequestReceived = User.RequestReceived || [];




            const allUsers = await UserModel.find({
                $and: [
                    { _id: { $ne: User._id } },
                    { _id: { $nin: PrivateConnection } },
                    { _id: { $nin: RequestSend } },
                    { _id: { $nin: RequestReceived } }
                ]
            }).select('Name Email UserName profilephoto status');
            console.log("all users", allUsers);

            const PrivateUseronline = await UserModel.find({
                _id: { $in: PrivateConnection },
                status: "Online"
            }).select('Name Email UserName profilephoto');
            const PrivateUseroffline = await UserModel.find({
                _id: { $in: PrivateConnection },
                status: "Offline"
            }).select('Name Email UserName profilephoto');
            const RequestSendUsers = await UserModel.find({
                _id: { $in: RequestSend }
            }).select('Name Email UserName profilephoto');

            const RequestReceivedUsers = await UserModel.find({
                _id: { $in: RequestReceived }
            }).select('Name Email UserName profilephoto');

            socket.emit("user-fetching", {
                PrivateUseroffline,
                PrivateUseronline,
                availableUsers: allUsers,
                RequestSendUsers,
                RequestReceivedUsers
            });
        }



    });
    socket.on('send-friend-request', async (data) => {
        try {
            const { senderEmail, receiverEmail } = data;


            const sender = await UserModel.findOne({ Email: senderEmail });
            const receiver = await UserModel.findOne({ Email: receiverEmail });

            if (!sender || !receiver) {
                return socket.emit('error', { message: 'User not found' });
            }


            if (!sender.RequestSend.includes(receiver._id)) {
                sender.RequestSend.push(receiver._id);
                await sender.save();
            }


            if (!receiver.RequestReceived.includes(sender._id)) {
                receiver.RequestReceived.push(sender._id);
                await receiver.save();
            }


            if (receiver.connectedid) {
                io.to(receiver.connectedid).emit('friend-request-received', {
                    Name: sender.Name,
                    Email: sender.Email,
                    UserName: sender.UserName,
                    profilephoto: sender.profilephoto
                });
            }


            socket.emit('friend-request-sent', {
                Name: receiver.Name,
                Email: receiver.Email,
                UserName: receiver.UserName,
                profilephoto: receiver.profilephoto
            });

        } catch (error) {
            console.error('Friend request error:', error);
            socket.emit('error', { message: 'Failed to send friend request' });
        }
    });

    socket.on('accept-friend-request', async (data) => {
        try {
            const { senderEmail, receiverEmail } = data;


            const sender = await UserModel.findOne({ Email: senderEmail });
            const receiver = await UserModel.findOne({ Email: receiverEmail });

            if (!sender || !receiver) {
                return socket.emit('error', { message: 'User not found' });
            }


            sender.RequestReceived = sender.RequestReceived.filter(id => !id.equals(receiver._id));
            receiver.RequestSend = receiver.RequestSend.filter(id => !id.equals(sender._id));

            console.log(sender, receiver)
            if (!sender.PrivateConnection.includes(receiver._id)) {
                sender.PrivateConnection.push(receiver._id);
            }
            if (!receiver.PrivateConnection.includes(sender._id)) {
                receiver.PrivateConnection.push(sender._id);
            }

            await sender.save();
            await receiver.save();


            if (receiver.connectedid) {
                io.to(receiver.connectedid).emit('friend-request-accepted', {
                    Name: sender.Name,
                    Email: sender.Email,
                    UserName: sender.UserName,
                    profilephoto: sender.profilephoto
                });
            }

            socket.emit('friend-request-accepted', {
                Name: sender.Name,
                Email: sender.Email,
                UserName: sender.UserName,
                profilephoto: sender.profilephoto
            });




        } catch (error) {
            console.error('Accept friend request error:', error);
            socket.emit('error', { message: 'Failed to accept friend request' });
        }
    });


    socket.on('send-message', async (data) => {
        try {
            const { message, senderId, receiverId } = data;

            
            const sender = await UserModel.findOne({ Email: senderId });
            const receiver = await UserModel.findOne({ Email: receiverId });

            if (!sender || !receiver) {
                throw new Error('Sender or receiver not found');
            }

            const newMessage = {
                message,
                sender: sender._id, // Use the ObjectId instead of email
                timestamp: new Date()
            };

            // Broadcast to all clients
            io.to(receiver.connectedid).emit('receive-message', {
                message: newMessage,
                senderId,
                receiverId
            });

            // Save to database using ObjectIds
            const chatId = [senderId, receiverId].sort().join('_');
            let chat = await ChatModel.findOne({ ChatId: chatId });

            if (!chat) {
                chat = await ChatModel.create({
                    ChatId: chatId,
                    participants: [sender._id, receiver._id], // Use ObjectIds
                    Messages: [newMessage]
                });
            } else {
                chat.Messages.push(newMessage);
                await chat.save();
            }
        } catch (error) {
            console.error('Message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('typing', (data) => {
        const { senderId, receiverId } = data;
        io.emit('user-typing', { senderId, receiverId });
    });
    socket.on('makeacall', async (data) => {
        console.log("makeacall", data)
        try {
            const { RemoteEmail, peerId } = data;
            
            // Find receiver using their email and get their connectedid
            const receiver = await UserModel.findOne({ Email: RemoteEmail });
            
            if (receiver && receiver.connectedid) {
                console.log("receiver", receiver.connectedid)
                
                io.to(receiver.connectedid).emit('callreceived', {
                    peerId,
                });
            }
        } catch (error) {
            console.error('Make call error:', error);
        }
    });

    socket.on('callaccepted', async ({ to }) => {
        try {
            // Find caller using their email
            const caller = await UserModel.findOne({ Email: to });
            if (caller && caller.connectedid) {
                io.to(caller.connectedid).emit('callaccepted');
            }
        } catch (error) {
            console.error('Call accept error:', error);
        }
    });
});


// Starting the server
httpServer.listen(8000, (err) => {
    if (err) {
        console.error('An error occurred:', err);
    } else {
        console.log('Server is running on http://localhost:8000');
    }
});
