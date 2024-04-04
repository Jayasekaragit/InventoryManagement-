const mongoose = require('mongoose');

const Schema = mongoose.Schema

const oilSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    price:{
        type: String,
        required: true
    },
    img:{
        type:String,
        data:Buffer
    }
},{timestamps:true})

module.exports = mongoose.model('oilModel',oilSchema);