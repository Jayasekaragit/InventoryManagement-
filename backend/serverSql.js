import express from 'express'
import bodyParser from 'body-parser'
import mysql from 'mysql'
import cors from 'cors'
// import fs from ('fs');
// const cors = require('cors')
import multer from 'multer'

const app = express()
app.listen(5000,()=>{
    console.log('new server runnig')
})
const upload = multer()

app.use(express.json());
app.use(cors())
// var corsOptions ={
//     origin:"http://localhost:8081"
// };
// app.use(cors(corsOptions));

// //req of content type
// app.use(express.json())

const db = mysql.createPool({
    connectionLimit:100,
    host:"localhost",
    user:"root",
    password:"",
    database:"oil-mart"
})

app.get('/',(req,res)=>{
    res.json('hi this came from back end')
})

app.get('/users',(req,res)=>{
    const userQ = "SELECT * FROM `user`"
    db.query(userQ,(err,data)=>{
        if(err){
            return res.json(err)
        }
        console.log(res.json(data))
        return res.json(data)
       
        
    })
})

app.get('/cashierdash',(req,res)=>{
    const ProductQ = "SELECT * FROM `Products`"
    db.query(ProductQ,(err,data)=>{
        if(err){
            return res.json(err)
        }
        // console.log(res.json(data))
        // const Newdata=  res.json(data)
        return res.json(data)   
    })
})

// app.get('/addOil',(req,res)=>{
//     const qury = 
// })

app.post('/adduser',(req,res)=>{
    const {userName,email,pass,role,telNo}=req.body;
    const sql = "INSERT INTO `user` (`userName`,`email`,`password`,`role`,`telNo`) VALUES (?,?,?,?,?)"
    db.query(sql,[userName,email,pass,role,telNo],(err,data)=>{
        if(err){
            res.json(err);
        }
        return res.status(200).json({message:'this is working'});
    })
})

app.post('/addNewUser',upload.none(),(req,res)=>{
    const {userName,password,role}=req.body;
    const sql = "INSERT INTO `user` (`user-name`,`password`,`role`) VALUES (?,?,?)"
    db.query(sql,[userName,password,role],(err,result)=>{
        if(err){
            res.status(500).json({message:'Server is not working'});
        }else{
            res.status(200).json({message:'Server is working '})
        }
    })
})

app.delete('/users:id',upload.none(),(req,res)=>{
    const userId = req.params.id;
    const q = "DELETE FROM user WHERE `user`.`id` = ?"
    db.query(q,[userId],(err,data)=>{
        if(err){
            res.json(err);
        }
        return res.status(200).json({message:'user deleted successfully'});
    })
})
