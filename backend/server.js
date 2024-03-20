const express = require('express');
require('dotenv').config();

//express app
const app = express();
const mongoose = require('mongoose');
const oilRoutes = require('./routes/oils');

//middleware
app.use(express.json())

app.use('/', (req, res, next) => {
    console.log(req.path, req.method);
    next();
})

//route
app.use('/api/oils', oilRoutes)

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        //listen for request
        app.listen(process.env.PORT, () => {
            console.log('wada hutto');
        })


    })
    .catch((err) => {
        console.log(err);
    })




