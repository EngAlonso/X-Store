            <strong>{edit ? 'حدّث بيانات المنتج' : 'أضف منتجًا إلى مخزونك'}</strong>
            <span>اختر نوع القطعة ثم أدخل بياناتها في خطوات واضحة وسريعة.</span>
          </div>
          <span className="product-form-required-note"><i/> الحقول المطلوبة عليها علامة *</span>
        </div>
        {!pricingOnlyEdit && <>
          {!edit && <div className="product-mode-switch field-wide">
            <button type="button" className={productMode === 'single' ? 'is-active' : ''} onClick={() => { setProductMode('single'); setPriceFormError(''); }}>
              <Package size={18}/><span><b>قطعة عادية</b><small>منتج واحد بلون ومقاس واحد أو بدون متغيرات</small></span>
            </button>
            <button type="button" className={productMode === 'multi' ? 'is-active' : ''} onClick={() => { setProductMode('multi'); setPriceFormError(''); }}>
              <Boxes size={18}/><span><b>قطعة متعددة</b><small>عدة ألوان ومقاسات مع مخزون مستقل لكل تركيبة</small></span>
            </button>
          </div>}
          <div className="product-form-section field-wide">
            <span className="product-form-section-number">01</span>
            <div><b>بيانات المنتج</b><small>الاسم والباركود للتعرّف عليه بسهولة.</small></div>
          </div>
          <Field className="product-form-field" label="اسم المنتج" name="name" required placeholder="مثال: تيشيرت قطني أسود" defaultValue={edit?.name}/>
          <Field className="product-form-field" label="الباركود (اختياري)" name="barcode" placeholder="اكتب الرقم أو امسح الكود" defaultValue={edit?.barcode || ''}/>
        </div>
        {pricingOnlyEdit && <div className="role-hint field-wide"><ShieldCheck size={16}/><span>تعديل الأسعار والكمية للمنتج: {edit?.name}. لا يمكنك تغيير بياناته الأساسية.</span></div>}
        {!pricingOnlyEdit && productMode === 'multi' && !edit ? (
          <>
            <div className="product-form-section field-wide">
              <span className="product-form-section-number">02</span>
              <div><b>بناء القطعة المتعددة</b><small>اكتب الألوان والمقاسات ثم أنشئ التركيبات تلقائيًا.</small></div>
            </div>
            <label className="field product-form-field">
              <span>الألوان</span>
              <input value={multiColorInput} onChange={e => setMultiColorInput(e.target.value)} placeholder="أسود، أبيض، كحلي" />
              <small className="field-hint">افصل بين الألوان بفاصلة.</small>
            </label>
            <label className="field product-form-field">
              <span>المقاسات</span>
              <input value={multiSizeInput} onChange={e => setMultiSizeInput(e.target.value)} placeholder="S، M، L، XL" />
              <small className="field-hint">يمكن ترك المقاسات فارغة إذا كان المنتج يعتمد على اللون فقط.</small>
            </label>
            <div className="field-wide product-variant-builder-actions">
              <button type="button" className="button button-quiet" onClick={generateMultiVariants}><Boxes size={16}/> إنشاء التركيبات</button>
              {multiVariants.length > 0 && <span>{multiVariants.length} تركيبة جاهزة</span>}
            </div>