const express = require("express");
const authRouter = express.Router();
const User = require('../models/user');
const {validateSignUpdata} = require("../utils/validation");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");


authRouter.get("/");

authRouter.post("/signup",async (req,res)=>{
    try{
        validateSignUpdata(req);
        const {firstName,lastName,emailId,password} = req.body;
        const passwordHash = await bcrypt.hash(password,10);

        const user = new User({
            firstName,
            lastName,
            emailId,
            password : passwordHash
        });

        const newUser = await user.save();
        const token = await newUser.getJWT();

        res.cookie("token", token, {
          expires: new Date(Date.now() + 3600000),
        });
        
        res.json({message : "User created",data : newUser});
    }
    catch(err){
        res.send("Error creating account : " + err);
    }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;
    const user = await User.findOne({ emailId });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.validatePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = await user.getJWT();

    res.cookie("token", token, {
      expires: new Date(Date.now() + 3600000),
    });

    res.status(200).json(user);
  } catch (err) {
    console.error("Login error:", err);
  }
});


authRouter.post("/logout",async (req,res)=>{
    res.cookie("token",null,{
        expires : new Date(Date.now()),
    });
    res.send("Log Out Successfully");
});




module.exports = authRouter;

