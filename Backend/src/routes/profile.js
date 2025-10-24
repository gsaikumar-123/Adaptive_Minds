const express = require("express");
const {userAuth} = require("../middlewares/auth");
const profileRouter = express.Router();
const {validateEditProfileData} = require("../utils/validation");
const bcrypt = require("bcrypt");
const validator = require("validator");

profileRouter.get("/profile/view", userAuth ,async(req,res)=>{
    try{
        const user = req.user;
        res.send(user);
    }
    catch(err){
        res.send("Error : " + err);
    }
});

profileRouter.patch("/profile/edit",userAuth,async(req,res)=>{
    try{
        if(!validateEditProfileData){
            throw new Error("Invalid Edit request");
        }
        else{
            const loggedInUser = req.user;

            Object.keys(req.body).forEach((key)=>(
                loggedInUser[key] = req.body[key]
            ));

            await loggedInUser.save();

            res.send($loggedInUser.firstName + "Your Profile updated");
        }
    }
    catch(err){
        res.send("Error : " + err);
    }
});

profileRouter.patch("/profile/password",userAuth,async(req,res)=>{
    try{
        const newPassword = req.body.password;
        const loggedInUser = req.user;

        if(!validator.isStrongPassword(newPassword)){
            throw new Error("Password is not strong enough");
        }

        loggedInUser.password = await bcrypt.hash(newPassword,10);
        await loggedInUser.save();

        res.send("Password updated");
    }
    catch(err){
        res.send("Error : " + err);
    }
});
     

module.exports = profileRouter;