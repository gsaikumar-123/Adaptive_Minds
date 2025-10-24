const jwt = require("jsonwebtoken");
const User = require("../models/user");


const userAuth = async (req,res,next)=>{
    try {
        const cookies = req.cookies;
        const {token} = cookies;

        if(!token){
            return res.status(401).send("Please Login");
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET is not set in environment variables');
            return res.status(500).send('Server configuration error');
        }

        const decoddedMessage = jwt.verify(token, jwtSecret);
        const {_id} = decoddedMessage;

        const user = await User.findById(_id);

        if(!user){
            throw new Error("User Not found");
        }
        req.user = user;
        next();
    } 
    catch (err) {
        res.send("Error : " + err);
    }

}

module.exports = {
    userAuth
};