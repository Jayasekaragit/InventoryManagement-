const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const validator = require('validator')
const { create } = require('./oilModel')

const Schema = mongoose.Schema

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique:true
    },
    password:{
        type:String,
        required: true
    }
})

//static signUp method
userSchema.statics.signup = async function(email,password){
    // const exists = await this.findOne({email})
    //validation 
    
    
    const exists = await this.findOne({email})
    if(exists){
        throw Error('email exists')
    }

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password,salt)

    const user = await this.create({email,password:hash})

    return user;
}

// const signin =async function(email,password){
//     console.log('done')
//     const newUser = await create({email,password})
//     return newUser

// }



module.exports = mongoose.model('User',userSchema)