// ============================================================
// 自习室座位预约系统 — 前端交互
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Auto-dismiss flash messages after 4 seconds
    const flashes = document.querySelectorAll('.flash');
    flashes.forEach(flash => {
        setTimeout(() => {
            flash.style.transition = 'opacity 0.4s, transform 0.4s';
            flash.style.opacity = '0';
            flash.style.transform = 'translateY(-8px)';
            setTimeout(() => flash.remove(), 400);
        }, 4000);
    });

    // Date input: set min to today
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        if (!dateInput.value || dateInput.value < today) {
            dateInput.value = today;
        }
        dateInput.setAttribute('min', today);
    }
});
