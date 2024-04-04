const express = require('express')

//controller Functions
const{signupUser,loginUser} = require('../controllers/userController')

const router = express.Router()

//login Route
router.post('/login',loginUser)

//signUp route
router.post('/signup',signupUser)

module.exports = router;