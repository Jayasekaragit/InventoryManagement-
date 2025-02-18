import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql";
import cors from "cors";
import multer from "multer";
import { body, validationResult } from 'express-validator';
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from "cookie-parser";
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Joi from 'joi';

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const jwt = jsonwebtoken;
const secretKey = 'yourSecretKey';

const app = express();

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:5173', // Make sure the origin is correct
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Add the methods you want to support
  allowedHeaders: ['Content-Type', 'Authorization'], // Add headers your requests may use
  credentials: true, // Allow credentials like cookies
};
app.use(cors(corsOptions));
app.use(cookieParser());

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

const upload = multer();
app.use(express.json());

const db = mysql.createPool({ 
  connectionLimit: 100,
  host: "localhost",
  user: "root",
  password: "",
  database: "oil-mart",
});

app.get('/', (req, res) => {
  res.json('hi this came from back end');
});

app.get('/users', (req, res) => {
  const userQ = "SELECT * FROM `user`";
  db.query(userQ, (err, data) => {
    if (err) {
      return res.json(err);
    }
    return res.json(data);
  });
});
app.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Email is not valid'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').notEmpty().withMessage('Role is required'),
    body('phone').matches(/^\d{10}$/).withMessage('Phone number must be 10 digits')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role, phone } = req.body;

    try {
      
      const userCheckQuery = 'SELECT * FROM `user` WHERE `userName` = ? OR `email` = ? OR `telNo` = ?';
      db.query(userCheckQuery, [username, email, phone], async (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database query failed', details: err.message });
        }
        
        if (results.length > 0) {
          // If any record is found, determine the type of conflict
          const conflicts = [];
          results.forEach(result => {
            if (result.userName === username) conflicts.push('Username already exists');
            if (result.email === email) conflicts.push('Email already exists');
            if (result.telNo === phone) conflicts.push('Phone number already exists');
          });

          return res.status(400).json({ errors: conflicts });
        }
        //
        //comit 

        // If no conflicts, proceed with user registration
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO `user` (`userName`, `email`, `password`, `role`, `telNo`) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [username, email, hashedPassword, role, phone], (err, data) => {
          if (err) {
            return res.status(500).json({ error: 'User registration failed', details: err.message });
          }
          return res.status(200).json({ message: 'User registration successful' });
        });
      });
    } catch (err) {
      return res.status(500).json({ error: 'Password hashing failed', details: err.message });
    }
  }
);


app.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email is not valid'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    console.log(`Login attempt for email: ${email}`);

    const sql = "SELECT * FROM `user` WHERE `email` = ?";
    db.query(sql, [email], async (err, data) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database query error' });
      }
      if (data.length === 0) {
        console.log('Email not found');
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = data[0];
      console.log(`User found: ${user.userName}`);

      try {
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log(`Password match: ${passwordMatch}`);

        if (!passwordMatch) {
          console.log('Password does not match');
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, secretKey, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'None', secure: true });

        return res.status(200).json({ message: 'Login successful', token, role: user.role ,user:user.userName});
      } catch (err) {
        console.error('Password comparison error:', err);
        return res.status(500).json({ error: 'Password comparison error' });
      }
    });
  }
);  


// app.use('/login', (req, res) => {
//       [
//         body('email').isEmail().withMessage('Email is not valid'),
//         body('password').notEmpty().withMessage('Password is required')
//       ],
//       async (req, res) => {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return res.status(400).json({ errors: errors.array() });
//         }
    
//         const { email, password } = req.body;
    
//         const sql = "SELECT * FROM `user` WHERE `email` = ?";
//         db.query(sql, [email], async (err, data) => {
//           if (err) {
//             return res.status(500).json({ error: 'Database query error' });
//           }
//           if (data.length === 0) {
//             return res.status(401).json({ message: 'Invalid email or password' });
//           }
    
//           const user = data[0];
    
//           try {
//             const passwordMatch = await bcrypt.compare(password, user.password);
//             if (!passwordMatch) {
//               return res.status(401).json({ message: 'Invalid email or password' });
//             }
    
//             const token = jwt.sign({ id: user.id, role: user.role }, secretKey, { expiresIn: '1h' });
//             res.cookie('token', token, { httpOnly: true, sameSite: 'None', secure: true });
//             res.send({ token: token })
//             console.log( res.status(200).json({ message: 'Login successful', token, role: user.role }));

//           } catch (err) {
//             return res.status(500).json({ error: 'Password comparison error' });
//           }
//         });
//       }
//   // res.send({
//   //   token: token,
//   // })
// });

const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.sendStatus(403);
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.sendStatus(403);
    }
    next();
  };
};

app.get('/protected', authenticateJWT, (req, res) => {
  res.status(200).json({ message: 'This is a protected route', user: req.user });
});

app.get('/admin', authenticateJWT, authorizeRole(['Admin']), (req, res) => {
  res.status(200).json({ message: 'This is an admin-only route', user: req.user });
});

app.get('/another-protected-route', authenticateJWT, authorizeRole(['Admin', 'Inventory_Manager']), (req, res) => {
  res.status(200).json({ message: 'This is another protected route', user: req.user });
});

app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logout successful' });
});

app.post("/addNewUser", upload.none(), (req, res) => {
  const { userName, password, role } = req.body;
  const sql = "INSERT INTO `user` (`userName`,`password`,`role`) VALUES (?,?,?)";
  db.query(sql, [userName, password, role], (err, result) => {
    if (err) {
      res.status(500).json({ message: "Server is not working" });
    } else {
      res.status(200).json({ message: "Server is working " });
    }
  });
});

app.delete("/admin/users/:id", upload.none(), (req, res) => {
  const userId = req.params.id;
  const q = "DELETE FROM user WHERE `user`.`id` = ?";
  db.query(q, [userId], (err, data) => {
    if (err) {
      res.json(err);
    }
    return res.status(200).json({ message: "user deleted successfully" });
  });
});

app.put("/admin/users/:id", upload.none(), (req, res) => {
  const userId = req.params.id;
  const { username, email, role, phone } = req.body;
  const q = "UPDATE user SET userName=?, email=?, role=?, telNo=? WHERE id=?";
  db.query(q, [username, email, role, phone, userId], (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Internal server error" });
    }
    return res.status(200).json({ message: "User updated successfully" });
  });
});

// app.get("/admin/products", (req, res) => {
//   const ProductQ = "SELECT * FROM `products`";
//   db.query(ProductQ, (err, data) => {
//     if (err) {
//       return res.json(err);
//     }
//     return res.json(data);
//   });
// });

app.get("/admin/categories", (req, res) => {
  const ProductQ = "SELECT * FROM `catergory`";
  db.query(ProductQ, (err, data) => {
    if (err) {
      return res.json(err);
    }
    return res.json(data);
  });
});


//add products APIS
app.get('/api/subcategories', (req, res) => {
  const sql = 'SELECT * FROM sub_catergory';
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.json(result);
  });
});


//get wearhouses
app.get('/api/warehouses', (req, res) => {
  db.query('SELECT * FROM wearhouses', (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(results);
    }
  });
});


// Endpoint to get brands
app.get('/api/brands', (req, res) => {
  const sql = 'SELECT * FROM brands';
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.json(result);
  });
});

// Endpoint to add a new product
app.post('/api/products', (req, res) => {
  const {
    sub_cat_id,
    brand_id,
    p_name,
    size,
    sell_price,
    sku,
    min_stock_level,
    reorder_quantity,
    barcode // Now this is a single barcode
  } = req.body;

  const query = `INSERT INTO products (sub_cat_id, brand_id, p_name,size,sell_price, sku, min_stock_level, reorder_quantity, barcode)
                 VALUES (?, ?, ?, ?, ?, ?,?, ?, ?)`;

  db.query(query, [
    sub_cat_id,
    brand_id,
    p_name,
    size,
    sell_price,
    sku,
    min_stock_level,
    reorder_quantity,
    barcode // Include the barcode in the query
  ], (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(201).json({ id: results.insertId, ...req.body });
    }
  });
});




// POST endpoint to add additional quantities and update barcodes for existing products
app.post('/ ', (req, res) => {
  const { productId, quantity, batchNumber, buyingPrice } = req.body;

  const updateStockQuery = `
    UPDATE products
    SET current_stock = current_stock + ?, batch_number = ?, buying_price = ?
    WHERE product_id = ?
  `;

  db.query(updateStockQuery, [quantity, batchNumber, buyingPrice, productId], (err, result) => {
    if (err) {
      console.error('Error updating stock:', err);
      return res.status(500).send('Error updating stock.');
    }
    res.status(200).send('Stock updated successfully.');
  });
});



app.post('/api/categories', (req, res) => {
  const { catergory_type } = req.body;
  const sql = 'INSERT INTO catergory (catergory_type) VALUES (?)';
  db.query(sql, [catergory_type], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(201).json({ message: 'Category added successfully' });
  });
});

// Endpoint to add a new subcategory
app.post('/api/subcategories', (req, res) => {
  const { cat_id, sub_cat_name,sub_cat_id } = req.body;
  const sql = ' INSERT INTO `sub_catergory` (`sub_cat_id`, `cat_id`, `sub_cat_name`) VALUES (NULL, ?, ?)';
 
  db.query(sql, [cat_id, sub_cat_name,sub_cat_id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(201).json({ message: 'Subcategory added successfully' });
  });
});

// Endpoint to add a new brand
app.post('/api/brands', (req, res) => {
  const { brand_name } = req.body;
  const sql = 'INSERT INTO brands (brand_name) VALUES (?)';
  db.query(sql, [brand_name], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(201).json({ message: 'Brand added successfully' });
  });
});

app.post(
  '/add-subcategory',
  [
    body('cat_id').isInt().withMessage('Category ID must be an integer'),
    body('sub_cat_name').notEmpty().withMessage('Subcategory name is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cat_id, sub_cat_name } = req.body;

    const sql = "INSERT INTO `sub_catergory` (`cat_id`, `sub_cat_name`) VALUES (?, ?)";
    db.query(sql, [cat_id, sub_cat_name], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database query error' });
      }
      res.status(201).json({ message: 'Subcategory added successfully' });
    });
  }
);
app.post('/api/stocks', (req, res) => {
  const { product_id, expiration_date, sell_price, quantity } = req.body;

  // Insert into stock_batches table
  const insertStockQuery = 'INSERT INTO stock_batches (product_id, expiration_date, buying_price) VALUES (?, ?, ?)';
  db.query(insertStockQuery, [product_id, expiration_date, sell_price], (error, result) => {
    if (error) {
      console.error('Error adding stock to stock_batches table:', error);
      res.status(500).json({ error: 'Error adding stock to stock_batches table' });
    } else {
      const inventory_id = result.insertId;

      // Update current stock in products table
      const updateProductStockQuery = 'UPDATE products SET current_stock = current_stock + ? WHERE product_id = ?';
      db.query(updateProductStockQuery, [quantity, product_id], (error) => {
        if (error) {
          console.error('Error updating current stock in products table:', error);
          res.status(500).json({ error: 'Error updating current stock in products table' });
        } else {
          res.status(200).json({ message: 'Stock added successfully' });
        }
      });
    }
  });
});

// Add barcode
app.post('/api/barcodes', (req, res) => {
  const { barcodes, badge_number } = req.body;

  // Create an array to store promises for each barcode insertion
  const barcodePromises = [];

  // Iterate over each barcode and create a promise to insert it into the database
  barcodes.forEach(barcode => {
    const barcodePromise = new Promise((resolve, reject) => {
      const insertBarcodeQuery = 'INSERT INTO product_barcodes (product_id, barcode) VALUES (?, ?)';
      db.query(insertBarcodeQuery, [badge_number, barcode], (error, result) => {
        if (error) {
          console.error('Error adding barcode:', error);
          reject(error);
        } else {
          resolve(result);
        }
      });
    });

    // Add the promise to the array
    barcodePromises.push(barcodePromise);
  });

  // Execute all promises in parallel
  Promise.all(barcodePromises)
    .then(() => {
      res.status(200).json({ message: 'Barcodes added successfully' });
    })
    .catch((error) => {
      console.error('Error adding barcodes:', error);
      res.status(500).json({ error: 'Error adding barcodes' });
    });
});

app.get('/categories', (req, res) => {
  const sql = "SELECT * FROM `catergory`";
  db.query(sql, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database query error' });
    }
    res.status(200).json(data);
  });
});

//new apis
// app.post('/api/stocks', async (req, res) => {
//   const { badge_number, quantity, expiration_date, sell_price, product_id, barcodes } = req.body;

//   try {
//     await pool.beginTransaction();

//     // Insert into stock_batches table
//     const stockQuery = 'INSERT INTO stock_batches (product_id, batch_number, expiration_date, buying_price) VALUES (?, ?, ?, ?)';
//     await pool.query(stockQuery, [product_id, badge_number, expiration_date, sell_price]);

//     // Insert barcodes
//     for (const barcode of barcodes) {
//       const barcodeQuery = 'INSERT INTO product_barcodes (product_id, barcode) VALUES (?, ?)';
//       await pool.query(barcodeQuery, [product_id, barcode]);
//     }

//     // Update product current stock
//     const updateStockQuery = 'UPDATE products SET current_stock = current_stock + ? WHERE product_id = ?';
//     await pool.query(updateStockQuery, [quantity, product_id]);

//     await pool.commit();
//     res.json({ success: true, message: 'Stock added successfully!' });
//   } catch (error) {
//     await pool.rollback();
//     console.error('Error adding stock:', error);
//     res.status(500).json({ success: false, message: 'Failed to add stock' });
//   }
// });


app.post('/api/products/update-stock', (req, res) => {
  const { productId, quantity } = req.body;

  const updateStockQuery = 'UPDATE products SET current_stock = current_stock + ? WHERE product_id = ?';

  pool.query(updateStockQuery, [quantity, productId], (err, result) => {
    if (err) {
      console.error('Error updating product stock:', err);
      return res.status(500).json({ success: false, message: 'Failed to update product stock' });
    }
    res.json({ success: true, message: 'Product stock updated successfully!', result });
  });
});


// Endpoint to get all suppliers
app.get('/api/suppliers', (req, res) => {
  const sql = 'SELECT * FROM suppliers'; // Make sure your table name and columns are correct
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(200).json(data);
  });
});

// get products
  app.get('/api/products', (req, res) => {
    const sql = `
      SELECT p.product_id, p.p_name, p.sell_price, b.brand_name,p.barcode,p.size
      FROM products p
      JOIN brands b ON p.brand_id = b.brand_id
      ORDER BY b.brand_name ASC
    `;
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database query error' });
      }
      res.status(200).json(results);
    });
  });

  const productSchema = Joi.object({
    product_id: Joi.number().integer().required(),
    p_name: Joi.string().max(255).required(),
    sell_price: Joi.number().precision(2).min(0).required(), // Ensuring sell_price is non-negative
    brand_name: Joi.string().max(255).required(),
    barcode: Joi.string().max(255).allow(null),
    size: Joi.number().allow(null)
  });
  app.get('/api/products', (req, res) => {
    const sql = `
      SELECT p.product_id, p.p_name, p.sell_price, b.brand_name, p.barcode, p.size
      FROM products p
      JOIN brands b ON p.brand_id = b.brand_id
      ORDER BY b.brand_name ASC
    `;
  
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database query error' });
      }
  
      // Validate each result using Joi
      const validatedResults = [];
      const errors = [];
      
      results.forEach((result) => {
        const { error, value } = productSchema.validate(result);
        if (error) {
          errors.push(error.details);
          console.error('Validation error:', error.details);
        } else {
          validatedResults.push(value);
        }
      });
  
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }
  
      res.status(200).json(validatedResults);
    });
  });
  





// Route to add stock batch for an existing product
app.post('/api/stock_batches', async (req, res) => {
  const { product_id, batch_number, quantity, expiration_date, sell_price } = req.body;

  try {
    // Insert the stock batch data into the database
    const stockQuery = `INSERT INTO stock_batches (product_id, batch_number, quantity, expiration_date, sell_price) VALUES (?, ?, ?, ?, ?)`;
    await db.query(stockQuery, [product_id, batch_number, quantity, expiration_date, sell_price]);
    
    // Respond with success
    res.status(201).json({ message: 'Stock batch added successfully' });
  } catch (error) {
    // Handle errors
    console.error('Error adding stock batch:', error);
    res.status(500).json({ error: 'Failed to add stock batch' });
  }
});


app.post('/api/stock', (req, res) => {
  const { product_id, quantity,sae_name,supplier_id,pack_size, expiration_date, buy_price, purchase_date,barcode } = req.body;
  const query = 'INSERT INTO stock_batches (product_id, quantity,barcode,sae_id,supplier_id,pack_size, expiration_date, buy_price, purchase_date) VALUES (?, ?, ?,?, ?,?,?, ?,?)';
  db.query(query, [product_id, quantity,barcode,sae_name,supplier_id,quantity, expiration_date, buy_price, purchase_date], (err, result) => {
    if (err) throw err;
    res.send({ success: true, message: 'Stock added successfully', result });
  });
});



// In your server.js or appropriate file





app.post('/api/suppliers', (req, res) => {
  const { s_name, contact_info,supplier_loc } = req.body;

  if (!s_name || !supplier_loc||!contact_info  ) {
    return res.status(400).send({ error: 'Please provide all required fields' });
  }

  const query = 'INSERT INTO `suppliers` ( `supplier_name`, `suppplier_location`, `supplier_number`) VALUES ( ?, ?, ?);'
  db.query(query, [s_name, supplier_loc, contact_info], (err, results) => {
    if (err) {
      return res.status(500).send({ error: 'Database query error' });
    }
    res.send({ message: 'Supplier added successfully', supplierId: results.insertId });
  });
});

app.post('/api/transactions', (req, res) => {
  const { } = req.body;
  const query = 'INSERT INTO stock_batches (product_id, quantity,barcode,sae_id,supplier_id,pack_size, expiration_date, buy_price, purchase_date) VALUES (?, ?, ?,?, ?,?,?, ?,?)';
  db.query(query, [product_id, quantity,barcode,sae_name,supplier_id,pack_size, expiration_date, buy_price, purchase_date], (err, result) => {
    if (err) throw err;
    res.send({ success: true, message: 'Stock added successfully', result });
  });
});




app.get('/api/suppliers/:supplier_id/products', (req, res) => {
  const supplierId = req.params.supplier_id;
  console.log(supplierId);
  const sql = `
  SELECT p_name AS product_name, sb.buy_price,  sb.inventory_id ,sb.quantity, sb.pack_size, sb.expiration_date, sb.purchase_date, sb.barcode
  FROM stock_batches sb
  JOIN products p ON sb.product_id = p.product_id
  WHERE sb.supplier_id = ?
    `;
  db.query(sql, supplierId, (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(results);
    }
  });
});


// Cashier APIS

// Endpoint to get products with quantities
app.get('/cashier/products', (req, res) => {
  const sql = `
  SELECT
  sb.inventory_id,
  p.product_id,
  p.p_name AS product_name,
  p.sell_price,
  p.size,
  b.brand_name,
  sc.sub_cat_name,
  p.barcode,
  SUM(sb.quantity) AS total_quantity
FROM
  products p
JOIN
  brands b ON p.brand_id = b.brand_id
JOIN
  stock_batches sb ON p.product_id = sb.product_id
JOIN
  sub_catergory sc ON p.sub_cat_id = sc.sub_cat_id
GROUP BY
  p.product_id,p.size, b.brand_name, sc.sub_cat_name
ORDER BY
  b.brand_name ASC, p.p_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});
app.get('/api/sae_grades', (req, res) => {
  const sql = `
  SELECT * FROM sae_grades
  `;

  db.query(sql, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});




app.post('/shops', async (req, res) => {
  const { name, location } = req.body;
  const query = 'INSERT INTO shops (name, location) VALUES (?, ?)';
  try {
      await db.query(query, [name, location]);
      res.status(201).json({ message: 'Shop created successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating shop' });
  }
});

// Fetch all shops
app.get('/api/shops', (req, res) => {
  const sql = 'SELECT * FROM shops'; // Make sure your table name and columns are correct
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(200).json(data);
  });
});

app.get('/api/users', (req, res) => {
  const sql = 'SELECT * FROM users'; // Make sure your table name and columns are correct
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(200).json(data);
  });
});

// Associate user with shop
app.post('/shops/add-user', async (req, res) => {
  const { shop_id, user_id } = req.body;
  const query = 'INSERT INTO shop_users (shop_id, user_id) VALUES (?, ?)';
  try {
      await db.query(query, [shop_id, user_id]);
      res.status(201).json({ message: 'User added to shop successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error adding user to shop' });
  }
});



app.get('/stockData', (req, res) => {
  const sql = "SELECT * FROM `stock_batches`";
  db.query(sql, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database query error' });
    }
    res.status(200).json(data);
  });
});

app.get('/admin/stocks', (req, res) => {
  const sql = `
  SELECT
  p.product_id,
  p.p_name AS product_name,
  p.sell_price,
  p.barcode,
  p.size,
  b.brand_name,
  sc.sub_cat_name,
  SUM(sb.quantity) AS total_quantity
FROM
  products p
JOIN
  brands b ON p.brand_id = b.brand_id
JOIN
  stock_batches sb ON p.product_id = sb.product_id
JOIN
  sub_catergory sc ON p.sub_cat_id = sc.sub_cat_id
GROUP BY
  p.product_id,p.size, b.brand_name, sc.sub_cat_name
ORDER BY
  b.brand_name ASC, p.p_name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.json(result);
  });
});

app.get('/api/users', (req, res) => {
  const sql = 'SELECT * FROM users'; // Make sure your table name and columns are correct
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.status(200).json(data);
  });
});


// Backend code to handle transactions and update stock_badge and inventory

// app.post('/cashier/transactions', (req, res) => {
//   const { transaction_items } = req.body;

//   // Validate transaction items
//   for (const item of transaction_items) {
//     if (item.quantity <= 0) {
//       return res.status(400).send('Invalid quantity for item');
//     }
//   }

//   // Start a new database transaction
//   db.getConnection((err, connection) => {
//     if (err) {
//       console.error(err);
//       return res.status(500).send('Error creating transaction');
//     }

//     connection.beginTransaction((err) => {
//       if (err) {
//         console.error(err);
//         return res.status(500).send('Error creating transaction');
//       }
    
//       // Insert a new transaction record into the transactions table
//       const transactionQuery = 'INSERT INTO transactions (created_at) VALUES (NOW())';
//       connection.query(transactionQuery, (err, result) => {
//         if (err) {
//           console.error(err);
//           return res.status(500).send('Error creating transaction');
//         }

//         // Get the ID of the newly created transaction
//         const transactionId = result.insertId;

//         // Insert a new record into the transaction_items table for each item in the cart
//         const itemQueries = transaction_items.map((item) => {
//           const query = `INSERT INTO transaction_items (transaction_id, product_id, quantity, price, total_price) VALUES (${transactionId}, ${item.product_id}, ${item.quantity}, ${item.price}, ${item.total_price})`;
//           return new Promise((resolve, reject) => {
//             connection.query(query, (err, result) => {
//               if (err) {
//                 console.error(err);
//                 reject(err);
//               } else {
//                 resolve(result);
//               }
//             });
//           });
//         });

//         // Wait for all item queries to complete
//         Promise.all(itemQueries)
//           .then(() => {
//             // Update stock quantities
//             const stockUpdateQueries = transaction_items.map((item) => {
//               const query = `UPDATE stock_batches SET quantity = quantity - ${item.quantity} WHERE product_id = ${item.product_id}`;
//               return new Promise((resolve, reject) => {
//                 connection.query(query, (err, result) => {
//                   if (err) {
//                     console.error(err);
//                     reject(err);
//                   } else {
//                     resolve(result);
//                   }
//                 });
//               });
//             });

//             return Promise.all(stockUpdateQueries);
//           })
//           .then(() => {
//             // Commit the transaction
//             connection.commit((err) => {
//               if (err) {
//                 console.error(err);
//                 return res.status(500).send('Error creating transaction');
//               }
//               console.log('Transaction created successfully');
//               // Send the transaction ID back to the client
//               res.send({ transaction_id: transactionId });
//               connection.release(); // release the connection back to the pool
//             });
//           })
//           .catch((err) => {
//             // Rollback the transaction
//             connection.rollback(() => {
//               console.error(err);
//               res.status(500).send('Error creating transaction');
//               connection.release(); // release the connection back to the pool
//             });
//           });
//       });
//     });
//   });
// });
app.post('/cashier/transactions', (req, res) => {
  const { transaction_items, moneyReceived, discountPercentage, is_credit_sale, customerName } = req.body; // Ensure moneyReceived and discountPercentage are passed in the request body

  // Validate transaction items
  for (const item of transaction_items) {
    if (item.quantity <= 0) {
      return res.status(400).send('Invalid quantity for item');
    }
  }

  // Start a new database transaction
  db.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error creating transaction');
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error creating transaction');
      }

      // Insert a new transaction record into the transactions table
      const transactionQuery = 'INSERT INTO transactions (created_at) VALUES (NOW())';
      connection.query(transactionQuery, (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error creating transaction');
        }

        // Get the ID of the newly created transaction
        const transactionId = result.insertId;

        // Fetch the selling price for each product
        const fetchPricePromises = transaction_items.map((item) => {
          const fetchPriceQuery = `SELECT sell_price FROM products WHERE product_id = ${item.product_id}`;
          return new Promise((resolve, reject) => {
            connection.query(fetchPriceQuery, (err, results) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                item.price = results[0].sell_price; // Store the fetched sell price in the item object
                item.total_price = item.price * item.quantity; // Calculate total price
                resolve(item);
              }
            });
          });
        });

        // Wait for all fetch price queries to complete
        Promise.all(fetchPricePromises)
          .then((itemsWithPrices) => {
            // Insert a new record into the transaction_items table for each item in the cart
            const itemQueries = itemsWithPrices.map((item) => {
              const query = `INSERT INTO transaction_items (transaction_id, product_id, quantity, price, sell_price, total_price) VALUES (${transactionId}, ${item.product_id}, ${item.quantity}, ${item.price}, ${item.price}, ${item.total_price})`;
              return new Promise((resolve, reject) => {
                connection.query(query, (err, result) => {
                  if (err) {
                    console.error(err);
                    reject(err);
                  } else {
                    resolve(result);
                  }
                });
              });
            });

            return Promise.all(itemQueries);
          })
          .then(() => {
            // Calculate total price of the transaction
            const totalTransactionPrice = transaction_items.reduce((sum, item) => sum + item.total_price, 0);

            // Update total price, cash received, and discount in transactions table
            const updateTransactionQuery = `UPDATE transactions SET total = ${totalTransactionPrice}, cash_received = ${moneyReceived}, discount = ${discountPercentage}, is_credit_sale = ${is_credit_sale}, customerName = '${customerName}' WHERE id = ${transactionId}`;
            return new Promise((resolve, reject) => {
              connection.query(updateTransactionQuery, (err, result) => {
                if (err) {
                  console.error(err);
                  reject(err);
                } else {
                  resolve(result);
                  console.log(result);
                }
              });
            });
          })
          .then(() => {
            // Function to update stock quantities recursively
            const updateStock = (item, remainingQuantity) => {
              return new Promise((resolve, reject) => {
                const query = `SELECT * FROM stock_batches WHERE product_id = ${item.product_id} AND quantity > 0 ORDER BY inventory_id ASC LIMIT 1`;
                connection.query(query, (err, results) => {
                  if (err) {
                    console.error(err);
                    return reject(err);
                  }

                  if (results.length === 0) {
                    return reject(new Error('Not enough stock'));
                  }

                  const batch = results[0];
                  const quantityToDeduct = Math.min(remainingQuantity, batch.quantity);

                  const updateQuery = `UPDATE stock_batches SET quantity = quantity - ${quantityToDeduct} WHERE inventory_id = ${batch.inventory_id}`;
                  connection.query(updateQuery, (err, result) => {
                    if (err) {
                      console.error(err);
                      return reject(err);
                    }

                    const newRemainingQuantity = remainingQuantity - quantityToDeduct;
                    if (newRemainingQuantity > 0) {
                      return resolve(updateStock(item, newRemainingQuantity));
                    }

                    resolve();
                  });
                });
              });
            };

            // Update stock quantities for all items
            const stockUpdatePromises = transaction_items.map((item) => updateStock(item, item.quantity));

            return Promise.all(stockUpdatePromises);
          })
          .then(() => {
            // Commit the transaction
            connection.commit((err) => {
              if (err) {
                console.error(err);
                return res.status(500).send('Error creating transaction');
              }
              console.log('Transaction created successfully');
              // Send the transaction ID back to the client
              res.send({ transaction_id: transactionId });
              connection.release(); // release the connection back to the pool
            });
          })
          .catch((err) => {
            // Rollback the transaction
            connection.rollback(() => {
              console.error(err);
              res.status(500).send('Error creating transaction');
              connection.release(); // release the connection back to the pool
            });
          });
      });
    });
  });
});







app.get('/cashier/transactions', (req, res) => {
  const query = 'SELECT transactions.id AS transaction_id,transactions.discount, transactions.created_at,transactions.cash_received,transactions.is_credit_sale,transactions.customerName, transaction_items.product_id, transaction_items.quantity, transaction_items.price, transaction_items.total_price, products.p_name FROM transactions JOIN transaction_items ON transactions.id = transaction_items.transaction_id JOIN products ON transaction_items.product_id = products.product_id';
  const { transaction_items } = req.body;
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error fetching transactions');
    } else {
      const transactions = results.reduce((acc, item) => {
        const transaction = acc[item.transaction_id];

        if (!transaction) {
          acc[item.transaction_id] = {
            transaction_id: item.transaction_id,
            created_at: item.created_at,
            is_credit_sale:item.is_credit_sale,
            customerName:item.customerName,
            transaction_items: []

          };
        }
        

        acc[item.transaction_id].transaction_items.push({
          product_id: item.product_id,
          product_name: item.p_name, // Include the product name here
          quantity: item.quantity,
          price: item.price,
          cash:item.cash_received,
          total_price: item.total_price,
          discount:item.discount


        });

        return acc;
      }, {});

      res.json(Object.values(transactions));
    }
  });
});



app.get('/inventory/report', (req, res) => {
  const { startDate, endDate, emptyStocks } = req.query;

  let query = `
    SELECT
      products.product_id,
      products.p_name,
      stock_batches.quantity,
      products.sell_price,
      stock_batches.purchase_date
    FROM
      stock_batches
    JOIN
      products ON stock_batches.product_id = products.product_id
  `;

  const conditions = [];

  if (startDate && endDate) {
    conditions.push(`stock_batches.purchase_date BETWEEN '${startDate}' AND '${endDate}'`);
  }

  if (emptyStocks === 'true') {
    conditions.push('stock_batches.quantity = 0');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error fetching inventory data');
    } else {
      // Create PDF
      const doc = new PDFDocument();
      const filePath = path.join(__dirname, 'inventory_report.pdf');
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(18).text('Inventory Report', { align: 'center' });
      doc.moveDown();

      if (startDate && endDate) {
        doc.fontSize(12).text(`Date Range: ${startDate} to ${endDate}`);
        doc.moveDown();
      }

      if (emptyStocks === 'true') {
        doc.fontSize(12).text('Empty Stocks Only');
        doc.moveDown();
      }

      results.forEach(item => {
        doc.fontSize(10).text(`Product ID: ${item.product_id}`);
        doc.text(`Product Name: ${item.p_name}`);
        doc.text(`Stock Quantity: ${item.quantity}`);
        doc.text(`Price: ${item.sell_price}`);
        doc.text(`Created At: ${item.purchase_date}`);
        doc.moveDown();
      });

      doc.end();

      stream.on('finish', () => {
        // Send PDF to client
        res.download(filePath, (err) => {
          if (err) {
            console.error('Error sending PDF:', err);
            res.status(500).send('Error sending PDF');
          }

          // Delete the file after sending
          fs.unlinkSync(filePath);
        });
      });
    }
  });
});
// app.get('/inventory/report', (req, res) => {
//   const { startDate, endDate, emptyStocks } = req.query;

//   let query = `
//     SELECT
//       products.product_id,
//       products.p_name,
//       stock_batches.quantity,
//       products.sell_price,
//       stock_batches.purchase_date
//     FROM
//       stock_batches
//     JOIN
//       products ON stock_batches.product_id = products.product_id
//   `;

//   const conditions = [];

//   if (startDate && endDate) {
//     conditions.push(`stock_batches.purchase_date BETWEEN '${startDate}' AND '${endDate}'`);
//   }

//   if (emptyStocks === 'true') {
//     conditions.push('stock_batches.quantity = 0');
//   }

//   if (conditions.length > 0) {
//     query += ' WHERE ' + conditions.join(' AND ');
//   }

//   db.query(query, (err, results) => {
//     if (err) {
//       console.error(err);
//       res.status(500).send('Error fetching inventory data');
//     } else {
//       // Create PDF
//       const doc = new PDFDocument();
//       const filePath = path.join(__dirname, 'inventory_report.pdf');
//       const stream = fs.createWriteStream(filePath);

//       doc.pipe(stream);

//       doc.fontSize(18).text('Inventory Report', { align: 'center' });
//       doc.moveDown();

//       if (startDate && endDate) {
//         doc.fontSize(12).text(`Date Range: ${startDate} to ${endDate}`);
//         doc.moveDown();
//       }

//       if (emptyStocks === 'true') {
//         doc.fontSize(12).text('Empty Stocks Only');
//         doc.moveDown();
//       }

//       // Table headers
//       doc.font('Helvetica-Bold').fontSize(10);
//       doc.text('Product ID', { width: 100, align: 'left' });
//       doc.text('Product Name', { width: 200, align: 'left' });
//       doc.text('Stock Quantity', { width: 100, align: 'left' });
//       doc.text('Price', { width: 100, align: 'left' });
//       doc.text('Purchase Date', { width: 150, align: 'left' });
//       doc.moveDown();

//       // Table rows
//       doc.font('Helvetica').fontSize(10);
//       results.forEach(item => {
//         doc.text(item.product_id.toString(), { width: 100, align: 'left' });
//         doc.text(item.p_name, { width: 200, align: 'left' });
//         doc.text(item.quantity.toString(), { width: 100, align: 'left' });
//         doc.text(item.sell_price.toString(), { width: 100, align: 'left' });
//         doc.text(item.purchase_date.toString(), { width: 150, align: 'left' });
//         doc.moveDown();
//       });

//       doc.end();

//       stream.on('finish', () => {
//         // Send PDF to client
//         res.download(filePath, (err) => {
//           if (err) {
//             console.error('Error sending PDF:', err);
//             res.status(500).send('Error sending PDF');
//           }

//           // Delete the file after sending
//           fs.unlinkSync(filePath);
//         });
//       });
//     }
//   });
// });


app.get('/api/inventory', (req, res) => {
  const sql = `
  SELECT
  sb.inventory_id,
  p.product_id,
  p.p_name AS product_name,
  p.sell_price,
  sb.pack_size,
  sb.quantity,
  sb.buy_price,
  b.brand_name,
  sc.sub_cat_name,
  s.supplier_name
FROM
  products p
JOIN
  brands b ON p.brand_id = b.brand_id
JOIN
  stock_batches sb ON p.product_id = sb.product_id
JOIN
  suppliers s ON sb.supplier_id = s.supplier_id
JOIN
  sub_catergory sc ON p.sub_cat_id = sc.sub_cat_id
GROUP BY
  sb.inventory_id,p.size, b.brand_name, sc.sub_cat_name 
ORDER BY
  b.brand_name ASC, p.p_name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: 'Database query error' });
    res.json(result);
  });
});


app.get('/api/sales', (req, res) => {
  const query = `SELECT * FROM transactions 
                 JOIN transaction_items ON transactions.id = transaction_items.transaction_id 
                 WHERE transactions.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching sales data:', error);
      res.status(500).send('Error fetching sales data');
      return;
    }
    res.json(results);
  });
});
// Route to fetch total profit for the last 7 days
app.get('/api/sales', (req, res) => {
  const query = `SELECT SUM(transaction_items.total_price - (transaction_items.quantity * stock_baadges.price)) AS total_profit
                 FROM transactions 
                 JOIN transaction_items ON transactions.id = transaction_items.transaction_id 
                 JOIN stock_baadges ON transaction_items.product_id = stock_baadges.id
                 WHERE transactions.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching total profit data:', error);
      console.log(results);
      res.status(500).send('Error fetching total profit data');
      return;
    }
    // Extracting total profit from the first row of results
    const totalProfit = results[0]?.total_profit || 0;
    res.json({ total_profit: totalProfit });
  });
});

// Route to generate PDF report
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { htmlContent } = req.body;
    const pdfFilePath = path.join(__dirname, 'sales_report.pdf');
    pdf.create(htmlContent).toFile(pdfFilePath, (err, _) => {
      if (err) {
        console.error('Error generating PDF:', err);
        return res.status(500).send('Error generating PDF');
      }
      res.download(pdfFilePath, 'sales_report.pdf', (err) => {
        if (err) {
          console.error('Error downloading PDF:', err);
          return res.status(500).send('Error downloading PDF');
        }
        // Delete the PDF file after downloading
        fs.unlinkSync(pdfFilePath);
      });
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});

app.get('/api/sales/weekly', (req, res) => {
  const query = `
      SELECT 
          p.p_name AS product_name,
          ti.sell_price AS selling_price,
          sb.buy_price AS buying_price,
          t.discount,is_credit_sale,
          SUM(ti.quantity) AS total_quantity_sold,
          SUM(ti.quantity * ti.sell_price) AS total_revenue,
          SUM(ti.quantity * sb.buy_price) AS total_cost,
          SUM(ti.quantity * (p.sell_price - sb.buy_price)) AS total_profit,
          YEARWEEK(t.created_at, 1) AS sales_week
      FROM 
          transactions t
      JOIN 
          transaction_items ti ON t.id = ti.transaction_id
      JOIN 
          products p ON ti.product_id = p.product_id
      JOIN 
          stock_batches sb ON p.product_id = sb.product_id
      GROUP BY 
      product_name, selling_price, buying_price, sales_date,discount,is_credit_sale
      ORDER BY 
          sales_week, total_profit DESC;
  `;
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).json({ error: err.message });
      }
      res.json(results);
  });
});

app.get('/api/sales/daily', (req, res) => {
  const query = `
  SELECT 
  t.discount,is_credit_sale,
  
  p.p_name AS product_name,
          ti.sell_price AS selling_price,
          sb.buy_price AS buying_price,
          SUM(ti.quantity) AS total_quantity_sold,
          SUM(ti.quantity * ti.sell_price) AS total_revenue,
          SUM(ti.quantity * sb.buy_price) AS total_cost,
          SUM(ti.quantity * (p.sell_price - sb.buy_price)) AS total_profit,
          DATE(t.created_at) AS sales_date
      FROM 
          transactions t
      JOIN 
          transaction_items ti ON t.id = ti.transaction_id
      JOIN 
          products p ON ti.product_id = p.product_id
      JOIN 
          stock_batches sb ON p.product_id = sb.product_id
      GROUP BY 
          product_name, selling_price, buying_price, sales_date,discount,is_credit_sale
      ORDER BY 
          sales_date, total_profit DESC;
  `;
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).json({ error: err.message });
      }
      res.json(results);
  });
});

// app.post('/api/notifications', (req, res) => {
//   const { productId, productName, message } = req.body;

//   // Insert notification into the database
//   const query = 'INSERT INTO notifications (product_id, product_name, message) VALUES (?, ?, ?)';
//   db.query(query, [productId, productName, message], (error, results) => {
//       if (error) {
//           console.error('Error inserting notification:', error);
//           res.status(500).json({ error: 'Error inserting notification' });
//           return;
//       }
//       res.status(200).json({ message: 'Notification inserted successfully' });
//   });
// });


// Route to fetch notifications
app.get('/api/notifications', (req, res) => {
  const query = `
  SELECT n.id, n.product_id, n.message, n.created_at, p.p_name 
  FROM notifications n
  JOIN products p ON n.product_id = p.product_id
  ORDER BY n.created_at DESC
`;
db.query(query, (error, results) => {
  if (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Error fetching notifications' });
      return;
  }
  res.status(200).json(results);
});
});

app.delete('/api/notifications/:id', (req, res) => {
  const notificationId = req.params.id;
  const deleteQuery = 'DELETE FROM notifications WHERE id = ?';
  db.query(deleteQuery, notificationId, (error, result) => {
    if (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Error deleting notification' });
      return;
    }
    res.status(200).json({ message: 'Notification deleted successfully' });
  });
});


// Route to handle PUT requests for updating product data
app.put('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  const { p_name, sell_price, barcode,size } = req.body;

  // Update the specific fields in the database
db.query(
    'UPDATE products SET p_name = ?, sell_price = ?, barcode = ?,size=? WHERE product_id = ?',
    
    [p_name, sell_price, barcode,size, productId],
    (error, results) => {
      if (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Error updating product' });
        return;
      }
      res.status(200).json({ message: 'Product updated successfully' });
    }
  );
});



app.get('/api/retunstock', (req, res) => {
  const query = `
    SELECT sb.inventory_id, p.product_id, p.p_name, sb.quantity, sb.purchase_date, s.supplier_name
    FROM stock_batches sb
    JOIN products p ON sb.product_id = p.product_id
    JOIN suppliers s ON sb.supplier_id = s.supplier_id
    WHERE sb.quantity > 0
  `;
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching stock:', error);
      res.status(500).json({ error: 'Error fetching stock' });
      return;
    }
    res.status(200).json(results);
  });
});

// Add item to returns table
app.post('/api/returns', (req, res) => {
  const { product_id, supplier_name, quantity, purchase_date } = req.body;
  const query = `
    INSERT INTO returns (product_id, supplier_name, quantity, purchase_date)
    VALUES (?, ?, ?, ?)
  `;
  db.query(query, [product_id, supplier_name, quantity, purchase_date], (error, results) => {
    if (error) {
      console.error('Error adding to returns:', error);
      res.status(500).json({ error: 'Error adding to returns' });
      return;
    }
    res.status(200).json({ message: 'Item added to returns successfully' });
  });
});


app.get('/api/returns', (req, res) => {
  const query = `
    SELECT r.return_id, r.product_id, r.supplier_name, r.quantity, r.purchase_date, p.p_name
    FROM returns r
    JOIN products p ON r.product_id = p.product_id
  `;
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching returns:', error);
      res.status(500).json({ error: 'Error fetching returns' });
      return;
    }
    res.status(200).json(results);
  });
});

// Confirm return
app.post('/api/returns/confirm/:return_id', (req, res) => {
  const { return_id } = req.params;
  const query1 = `
    SELECT * FROM returns WHERE return_id = ?
  `;
  const query2 = `
    UPDATE stock_batches SET quantity = quantity - ? WHERE product_id = ? AND supplier_id = (SELECT supplier_id FROM suppliers WHERE supplier_name = ? LIMIT 1)
  `;
  const query3 = `
    DELETE FROM returns WHERE return_id = ?
  `;

  db.query(query1, [return_id], (error, results) => {
    if (error) {
      console.error('Error confirming return:', error);
      res.status(500).json({ error: 'Error confirming return' });
      return;
    }

    const returnItem = results[0];
    const { product_id, supplier_name, quantity } = returnItem;

    db.query(query2, [quantity, product_id, supplier_name], (error) => {
      if (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: 'Error updating stock' });
        return;
      }

      db.query(query3, [return_id], (error) => {
        if (error) {
          console.error('Error deleting return:', error);
          res.status(500).json({ error: 'Error deleting return' });
          return;
        }
        res.status(200).json({ message: 'Return confirmed successfully' });
      });
    });
  });
});

// Cancel return
app.delete('/api/returns/cancel/:return_id', (req, res) => {
  const { return_id } = req.params;
  const query = `
    DELETE FROM returns WHERE return_id = ?
  `;
  db.query(query, [return_id], (error) => {
    if (error) {
      console.error('Error canceling return:', error);
      res.status(500).json({ error: 'Error canceling return' });
      return;
    }
    res.status(200).json({ message: 'Return canceled successfully' });
  });
});


app.delete('/api/transaction/:id', (req, res) => {
  const transactionId = req.params.id;


  const deleteQuery = 'DELETE FROM transaction_items WHERE transaction_id = ?';
  

  const deleteTrans = 'DELETE FROM transactions WHERE id = ?';


  db.query(deleteQuery, transactionId, (error, result) => {
    if (error) {
      console.error('Error deleting transaction items:', error);
      res.status(500).json({ error: 'Error deleting transaction items' });
      return;
    }

  
    db.query(deleteTrans, transactionId, (error, result) => {
      if (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Error deleting transaction' });
        return;
      }

      // If both deletions are successful, send a success response
      res.status(200).json({ message: 'Transaction and related items deleted successfully' });
    });
  });
});



app.put('/api/updateTransaction/:id', (req, res) => {
  const transaction_id = req.params.id;

  // Update the specific fields in the database
  db.query(
    `UPDATE transactions SET is_credit_sale = 0 WHERE id = ${transaction_id}`,
    (error, results) => {
      if (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Error updating transaction' });
        return;
      }
      res.status(200).json({ message: 'Transaction updated successfully' });
    }
  );
});
