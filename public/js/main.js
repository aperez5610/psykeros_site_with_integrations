
/* Minimal frontend JS for language switch, booking form submission, and mobile behaviour */
document.addEventListener('DOMContentLoaded', ()=>{

  const langToggle = document.getElementById('langToggle');
  if(langToggle){
    langToggle.addEventListener('click', ()=>{
      const current = document.documentElement.lang || 'es';
      const next = current === 'es' ? 'en' : 'es';
      document.documentElement.lang = next;
      // In a full app you would load translations; here we toggle text nodes with data-i18n
      document.querySelectorAll('[data-en]').forEach(el=>{
        el.textContent = next === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-es');
      });
    });
  }

  // Booking form (simple demo)
  const bookForm = document.getElementById('bookForm');
  if(bookForm){
    bookForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(bookForm).entries());
      try{
        const res = await fetch('/api/appointments', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(data)
        });
        const json = await res.json();
        alert(json.message || 'Cita creada');
        bookForm.reset();
      }catch(err){
        alert('Error creando la cita');
      }
    });
  }

});
