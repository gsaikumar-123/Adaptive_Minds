const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = mongoose.Schema({
    firstName : {
        type : String,
        required : true,
        minlength : 4,
        maxlength : 50
    },
    lastName : {
        type : String
    },
    emailId : { 
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim : true,
        validator : function(value){
            if(!validator.isEmail(value)){
                throw new Error("Invalid Email");
            }
        }
    },
    password : {
        type : String,
        required : true,
        validator : function(value){
            if(!validator.isStrongPassword(value)){
                throw new Error("Password is not strong enough");
            }
        }
    }
},
{
    timestamps : true,
});


userSchema.index({firstName:1,lastName:1});

userSchema.methods.getJWT = async function (){
    const user = this;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const token = await jwt.sign({_id : user._id}, jwtSecret, {
        expiresIn : "7d",
    });

    return token;
}

userSchema.methods.validatePassword = async function(passwordInputByUser){
    const user = this;
    passwordHash = user.password

    const isMatch = await bcrypt.compare(passwordInputByUser,passwordHash);
    return isMatch;
}



const User = mongoose.model("User",userSchema);

module.exports = User;