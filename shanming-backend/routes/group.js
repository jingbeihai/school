const express = require('express');
const router = express.Router();
const Response = require('../utils/response');
const auth = require('../middleware/auth');

router.get('/health', auth, (req, res) => { res.json(Response.success({ role: req.role })); });

module.exports = router;
