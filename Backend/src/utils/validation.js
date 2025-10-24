const validator = require("validator");

const validateSignUpdata = (req)=>{
    const {firstName,lastName,emailId,password} = req.body;

    if(!firstName || !lastName){
        throw new Error("Name is not valid");
    }

    if(!validator.isEmail(emailId)){
        throw new Error("Invalid Email");
    }

    if(!validator.isStrongPassword(password)){
        throw new Error("Enter a strong password");
    }
}

const validateEditProfileData = (req) =>{
    const allowed = ["firstName","lastName","emailId","photoUrl","age","gender","about","skills"];
    const isAllowed = Object.keys(req.body).every((update)=>
        allowed.includes(update)
    );

    return isAllowed;
}

module.exports = {validateSignUpdata,validateEditProfileData};