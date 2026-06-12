import re

with open("manager/app/dashboard/inventory/page.tsx", "r") as f:
    code = f.read()

chunk1_target = """interface SellFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  payment_mode: string;
  discount: number;
}"""
chunk1_rep = """interface SellFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  payment_mode: string;
  discount: number;
}"""
code = code.replace(chunk1_target, chunk1_rep)


chunk2_target = "  const [sellForm, setSellForm] = useState<SellFormData>({ customer_name: '', customer_phone: '', customer_email: '', payment_mode: 'cash', discount: 0 });"
chunk2_rep = "  const [sellForm, setSellForm] = useState<SellFormData>({ customer_name: '', customer_phone: '', customer_email: '', shipping_address: '', shipping_city: '', shipping_state: '', shipping_pincode: '', payment_mode: 'cash', discount: 0 });"
code = code.replace(chunk2_target, chunk2_rep)


chunk3_target = """        sold_customer_phone: sellForm.customer_phone || undefined,
        sold_customer_email: sellForm.customer_email || undefined,
        payment_mode: sellForm.payment_mode,"""
chunk3_rep = """        sold_customer_phone: sellForm.customer_phone || undefined,
        sold_customer_email: sellForm.customer_email || undefined,
        shipping_address: sellForm.shipping_address || undefined,
        shipping_city: sellForm.shipping_city || undefined,
        shipping_state: sellForm.shipping_state || undefined,
        shipping_pincode: sellForm.shipping_pincode || undefined,
        payment_mode: sellForm.payment_mode,"""
code = code.replace(chunk3_target, chunk3_rep)


# Find the outer div of the Sell Modal body and replace it.
# We will use regex to capture the entire <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8"> ... </div>
import re
match = re.search(r'          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">.*?(?=          </div>\n        </div>\n      \)}[\s\r\n]+{\/\* ── Damage Modal ── \*\/})          </div>', code, re.DOTALL)
if match:
    old_modal = match.group(0)
    
    new_modal = """          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-5xl p-8 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">Sell Item</h2>
                <p className="text-sm text-slate-400 font-medium line-clamp-1">{(sellItem.product_id as any)?.name}</p>
              </div>
              <button onClick={() => { setSellItem(null); setOtpSent(false); setPhoneVerified(false); setOtp(''); setOtpError(''); }} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Customer Name <span className="text-red-500">*</span></label>
                    <input type="text" value={sellForm.customer_name} onChange={(e) => setSellForm({ ...sellForm, customer_name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] transition-all hover:border-slate-300 shadow-sm" placeholder="Full Name" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#7A1C2A] mb-2">Final Sale Price (₹) <span className="text-red-500">*</span></label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-black text-[#5A0F1A] flex justify-between items-center shadow-sm">
                      <span>{(Math.round((sellItem.live_selling_price ?? sellItem.selling_price) * (1 - sellForm.discount / 100))).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      {sellForm.discount > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">-{sellForm.discount}% MS</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Phone <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 items-center">
                      <input type="tel" value={sellForm.customer_phone} onChange={(e) => { setSellForm({ ...sellForm, customer_phone: e.target.value }); setPhoneVerified(false); setOtpSent(false); setOtpError(''); }}
                        disabled={phoneVerified || otpSent}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-[#7A1C2A] shadow-sm" placeholder="+91..." />
                      {sellForm.customer_phone && !phoneVerified && !otpSent && (
                        <button onClick={handleSendOTP} disabled={otpSending} className="px-5 py-3.5 bg-[#5A0F1A] text-white text-[10px] font-black uppercase tracking-widest rounded-xl whitespace-nowrap hidden lg:block shadow-sm hover:bg-[#7A1C2A]">
                          {otpSending ? '...' : 'OTP'}
                        </button>
                      )}
                      {phoneVerified && (
                         <div className="flex items-center justify-center px-4 py-3.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200 shadow-sm"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg></div>
                      )}
                    </div>
                    {sellForm.customer_phone && !phoneVerified && !otpSent && (
                      <button onClick={handleSendOTP} disabled={otpSending} className="w-full mt-2 py-3.5 bg-[#5A0F1A] text-white text-[10px] font-black uppercase tracking-widest rounded-xl lg:hidden shadow-sm hover:bg-[#7A1C2A]">
                        {otpSending ? '...' : 'SEND OTP'}
                      </button>
                    )}
                    {otpSent && !phoneVerified && (
                      <div className="mt-3 flex gap-2">
                        <input type="text" placeholder="OTP" value={otp} onChange={(e)=>setOtp(e.target.value)} 
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3.5 text-sm font-black tracking-[0.3em] text-center text-slate-900 focus:outline-[#7A1C2A] shadow-sm" />
                        <button onClick={handleVerifyOTP} className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl whitespace-nowrap shadow-sm">VERIFY</button>
                      </div>
                    )}
                    {otpError && <p className="text-[10px] text-red-600 font-bold mt-1.5">{otpError}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Email</label>
                    <input type="email" value={sellForm.customer_email} onChange={(e) => setSellForm({ ...sellForm, customer_email: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] shadow-sm" placeholder="email@..." />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Shipping Address</label>
                  <input type="text" value={sellForm.shipping_address} onChange={(e) => setSellForm({ ...sellForm, shipping_address: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] shadow-sm" placeholder="Full address..." />
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">City</label>
                    <input type="text" value={sellForm.shipping_city} onChange={(e) => setSellForm({ ...sellForm, shipping_city: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">State</label>
                    <input type="text" value={sellForm.shipping_state} onChange={(e) => setSellForm({ ...sellForm, shipping_state: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pin</label>
                    <input type="text" value={sellForm.shipping_pincode} onChange={(e) => setSellForm({ ...sellForm, shipping_pincode: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] shadow-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Payment Mode</label>
                    <select value={sellForm.payment_mode} onChange={(e) => setSellForm({ ...sellForm, payment_mode: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-[#7A1C2A] shadow-sm appearance-none">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="emi">EMI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sale Branch <span className="text-[#7A1C2A]">*</span></label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 shadow-sm truncate">
                      {user?.branch?.name || 'Loading...'}
                    </div>
                  </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                     Manager Discount (Max {sellItem.max_manager_discount}%)
                   </label>
                   <div className="flex items-center gap-3">
                     <input type="number" min={0} max={sellItem.max_manager_discount} value={sellForm.discount} onChange={(e) => setSellForm({ ...sellForm, discount: Math.min(Number(e.target.value), sellItem.max_manager_discount) })}
                       className="w-24 bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-center text-slate-900 focus:outline-[#7A1C2A] shadow-sm"
                     />
                     <span className="text-xs font-medium text-slate-400">Lowers Final Sale Price automatically.</span>
                   </div>
                </div>
              </div>
            </div>

            <div id="recaptcha-cont"></div>
            <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-slate-100">
              <button onClick={() => { setSellItem(null); setOtpSent(false); setPhoneVerified(false); setOtp(''); setOtpError(''); }} className="px-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                Cancel
              </button>
              <button onClick={handleSell} disabled={selling} className="px-10 py-3.5 bg-[#5A0F1A] hover:bg-[#7A1C2A] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors shadow-md disabled:opacity-60 flex items-center justify-center">
                {selling ? 'Processing...' : 'Confirm Sale'}
              </button>
            </div>
          </div>"""
    
    code = code.replace(old_modal, new_modal)
    print("Modal successfully replaced")
else:
    print("Error: Could not find modal body")

with open("manager/app/dashboard/inventory/page.tsx", "w") as f:
    f.write(code)

print("Patching complete.")

