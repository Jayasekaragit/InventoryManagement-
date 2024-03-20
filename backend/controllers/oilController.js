const oilModel = require('../models/oilModel');
const mongoose = require('mongoose');

//get all oils
const getAllOils = async(req,res)=>{
    const allOils = await oilModel.find({}).sort({createdAT: -1})
    res.status(200).json(allOils);
}

//get one oil
const getanOil = async(req,res)=>{
    const {id} = req.params
    if(!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).json({error:"no such file"})
    }
    const oil = await oilModel.findById(id)
    
    if(!oil){
        return res.status(404).json({error: "no such oil exhist"})
    }

    res.status(200).json(oil)
}

//create new oil
const createNewOil = async (req,res)=>{
    const {title,price} = req.body 
    try{
        const oil = await oilModel.create({title,price})
        res.status(200).json(oil); 
    }
    catch(error){
       res.status(400).json({error: error.messege})
    }
}

//delete a new oil
const deleteanOil = async(req,res)=>{
    const {id} = req.params

    if(!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).json({error:"no such file"})
    }

    const oil = await oilModel.findOneAndDelete({_id: id})
    if(!oil){
        return res.status(404).json({error: "no such oil exhist"})
    }
    res.status(200).json(oil);
}


//update a oil
const updateanOil =async (req,res)=>{
    const {id} = req.params

    if(!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).json({error:"no such file"})
    }
    const oil = await oilModel.findOneAndUpdate({_id: id},{...req.body})
    if(!oil){
        return res.status(404).json({error: "no such oil exhist"})
    }
    res.status(200).json(oil);
}

module.exports = {
    createNewOil,
    getAllOils,
    getanOil,
    deleteanOil,
    updateanOil
}
