const User = require('../models/userModel')

const check =  new User;
//login user
const loginUser = async(req,res)=>{
    res.json({messg:'login user'})
}

//signup user

const signupUser = async(req,res)=>{
    const {email,password} = req.body
    try{
        const user = await User.signup(email,password)
        res.status(200).json({email,user})
    }catch(error){
        res.status(400).json({error: error.message})
    }
    
    // res.json({messg:'signup user'})
}


module.exports = {signupUser,loginUser}