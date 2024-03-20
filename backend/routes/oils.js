const express = require('express');
const {
    createNewOil,
    getAllOils,
    getanOil,
    deleteanOil,
    updateanOil
} = require('../controllers/oilController') 
const router = express.Router();

//get all oils
router.get('/',getAllOils);

//get a one oil detail
router.get('/:id',getanOil);

//post a new oil
router.post('/',createNewOil)

//delete a new oil
router.delete('/:id',deleteanOil)

//update a new oil
router.patch('/:id',updateanOil)


module.exports = router;