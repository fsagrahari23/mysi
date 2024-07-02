const express=require("express");
const app=express();
const cookieparser =require('cookie-parser')
const path = require('path')
const expressSession=require("express-session");
const flash=require("connect-flash")
const db=require('./config/mongoose-connection')
const ownerRouter=require('./routes/ownerRouter');
const userRouter=require('./routes/usersRouter');
const productRouter=require('./routes/productRouter');

const bodyParser = require('body-parser');


const isloggedin=require('./middlewares/isLoggedIn');
const userModel = require("./models/userModel");
const productModel=require("./models/product");
const Order=require("./models/order");

require("dotenv").config();


app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true}));
app.use(cookieparser())
app.use(express.static(path.join(__dirname,"public")));
app.set('view engine','ejs');

app.use(
  expressSession({
    resave:false,
    saveUninitialized:false,
    secret:process.env.JWT_KEY
  })
)
app.use(flash());
app.get("/",(req,res)=>{
  let error = req.flash("error")
  res.render("index",{error:error , loggedin:false});
})

app.get("/shop",isloggedin,async(req,res)=>{
  try{
  let success = req.flash("success")
   let products= await productModel.find();
   res.render("shop",{products,success});
  }catch(err){
    res.redirect('/err-page')
}
})

app.get("/addtocart/:id",isloggedin,async(req,res)=>{
  
  try{
   
  const user = await userModel.findOne({email: req.user.email}).populate('cart');
  // const product = await productModel.findById(req.params.id);
  const cartItem = user.cart.find(item => item.product.equals(req.params.id));
  if(cartItem) {
    cartItem.quantity += 1;
    } else {
      user.cart.push({product:req.params.id, quantity: 1 });
      }
  // user.cart.push(req.params.id);
  await user.save();
  req.flash("success","Added to cart");
 res.redirect("/shop");
}catch(err){
  res.redirect('/err-page')
}

})
app.get("/cart",isloggedin,async(req,res)=>{
  
  try{
  const user = await userModel.findOne({email: req.user.email}).populate("cart.product")
  let success = req.flash("success");
  // const cart=user.cart.product;
  const cartData = user.cart.map(item => ({
    productId: item.product._id,
    name: item.product.name,
    image:item.product.image,
    price: item.product.price,
    quantity: item.quantity,
    discount: item.product.discount,
    bgcolor:item.product.bgcolor,
    panelcolor:item.product.panelcolor,
    textcolor:item.product.textcolor,
    total: item.product.price * item.quantity - item.product.discount * item.quantity,
    

  }));
  
  var t=0,q=0,d=0;
  cartData.forEach(item => {
    t += item.total;
    q += item.quantity;
    d += item.discount;

  })
  var Total=t+(q*20)-d;
  // console.log(cartData)
  res.render('cart',{user,cartData,t,q,d,Total,success});
}catch(err){
  res.redirect('/err-page')
}
})
app.get("/decrease/:id",isloggedin,async(req,res)=>{
  
  try{
  const user = await userModel.findOne({email: req.user.email}).populate("cart");
  const cartItem = user.cart.find(item => item.product.equals(req.params.id));
  if(cartItem.quantity > 1) {
    cartItem.quantity -= 1;
    } else {
      user.cart.pull(cartItem);
      }
      await user.save();
      req.flash("success","Decreased from cart");
      res.redirect("/cart");
    }catch(err){
        res.redirect('/err-page')
    }
      
})
app.get("/increase/:id",isloggedin,async(req,res)=>{
  try{
  const user = await userModel.findOne({email: req.user.email}).populate("cart");
  const cartItem = user.cart.find(item => item.product.equals(req.params.id));
  if(cartItem.quantity >= 1) {
    cartItem.quantity += 1;
    } else {
      user.cart.push(req.params.id);
      }
      await user.save();
      req.flash("success","Increased from cart");
      res.redirect("/cart");
    }catch(err){
      res.redirect('/err-page')
  }
      
})

app.post('/orders',isloggedin,async(req,res)=>{
  try{
   const user = await userModel.findOne({email:req.user.email}).populate('orders');
   const { total, items } = req.body;
  res.render('order', { total, items });
}catch(err){
  res.redirect('/err-page')
}
  
})
app.post('/submit-order', isloggedin,async (req, res) => {
  
  try {
    const user= await userModel.findOneAndUpdate({email:req.user.email},{cart:[]})
    const { total, items, name, email, address,contact } = req.body;

    const newOrder = new Order({
      total:total,
      items: items,
      customer: {
        name,
        email,
        address,
        contact
      }
    });
    

    
    
    const savedOrder = await newOrder.save();
    user.orders.push(savedOrder._id);
    user.contactNumbers.push(contact);
    user.address=address;
    await user.save();
    
    res.redirect('/userOrders');
  } catch (err) {
    
    res.status(500).send('Failed to place order');
  }
});

app.get('/userOrders',isloggedin,(req,res)=>{
  userModel.findOne({email:req.user.email}).populate('orders').then((user)=>{
    res.render('orders',{user});
    })

})
app.get('/err-page',(req,res)=>{
  res.render('err-page');
})
app.use("/owner",ownerRouter);
app.use("/users",userRouter);
app.use("/products",productRouter);



app.listen(3000);
