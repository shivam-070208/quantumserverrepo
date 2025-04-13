const express = require('express');
const router = express.Router()
const UserModel = require('../mongoDB/models/Usermodel')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ChatModel = require('../mongoDB/models/Chat');



router.post('/Signin', async (req, res) => {
    const { Name, UserName, Email, Password } = req.body;
    console.log(UserName, Email, Password);
    console.log("5reqwjej")
    try {
        // Check both Email and UserName
        const emailExists = await UserModel.findOne({ Email });
        const usernameExists = await UserModel.findOne({ UserName });

        if (emailExists) {
            return res.status(400).json({ message: "Email already exists" });
        }
        if (usernameExists) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(Password, salt);

        const CreatedUser = await UserModel.create({
            Name: Name,
            Email: Email,
            UserName: UserName,
            Password: hashedPassword
        });
        console.log("done")
        const token = jwt.sign({ Email }, "webdevthejacker", { expiresIn: '1000h' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24
        });

      
        res.status(200).json({ message: "User created successfully", SignIn: true, Email: Email, User: CreatedUser });

    } catch (err) {
        console.log('unable to create user ', err);
       

        res.status(500).json({ message: "Server error", SignIn: false });
    }
});


router.post('/Login', async (req, res) => {
    
    const { Email, Password } = req.body;
    try {
        const user = await UserModel.findOne({ Email });
        if (!user) {
            return res.status(404).json({ message: "User with  email not found", Login: false });
        }

        const isPasswordValid = await bcrypt.compare(Password, user.Password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password", Login: false });
        }

        const token = jwt.sign({ Email }, "webdevthejacker", { expiresIn: '1000h' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: false, 
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24
        });
        res.status(200).json({ message: "Login successful", Login: true, Email: Email, User: user });
    } catch (err) {
        console.log('unable to login user ', err);
        res.status(500).json({ message: "Server error" });
    }
});
router.post('/isLoggedIn', async (req, res) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(201).json({ message: false });
    }

    try {
        const decoded = jwt.verify(token, "webdevthejacker");
        if (!decoded.Email) {
            return res.status(201).json({ message: false });
        }
        const Email=decoded.Email;

        const user = await UserModel.findOne({ Email: Email });
        if (!user) {
            res.clearCookie('token');
            return res.status(201).json({ message: false });
        }

        return res.status(200).json({ message: true,Email:Email,User:user });

    } catch (err) {
        console.log('Invalid token ', err);
        res.clearCookie('token');
        return res.status(400).json({ message: false });
    }
});
router.get('/', async (req, res) => {
 res.send("hello from user route")
}
)

router.post('/Logout', (req, res) => {
    res.clearCookie('token'); 
    res.status(200).json({ message: "Logout successful" });
});


router.post('/chat', async (req, res) => {
    try {
        const {chatId} = req.body
        console.log(chatId)
          
        const chatData = await ChatModel.findOne({ chatId: chatId });
        if (!chatData) {
            return res.status(404).json({ message: [] });
        }
        const messages = chatData.Messages.map(message => {
            return {
                message: message.message,
                sender: message.sender,
                timestamp: message.timestamp
            };
        });
        
        res.status(200).json({ messages });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message });
    }
});





module.exports = router;
