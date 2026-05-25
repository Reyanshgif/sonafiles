exports.register = async (req, res, next) => {
  try {
    const {
      shopName,
      ownerName,
      email,
      phone,
      password,
      businessType,
      gstNumber,
      panNumber,
      bisLicence,
      address   // ← this is the nested object
    } = req.body;

    const existing = await Vendor.findOne({ email });
    if (existing) {
      return res.status(409).json({ status: 'error', message: 'Email already registered.' });
    }

    const vendor = await Vendor.create({
      shopName,
      ownerName,
      email,
      phone,
      password,
      businessType,
      gstNumber,
      panNumber,
      bisLicence,
      address: address ? {  // ← explicitly map sub-fields
        street: address.street,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India'
      } : undefined
    });

    sendToken(vendor, 201, res);
  } catch (err) {
    next(err);
  }
};