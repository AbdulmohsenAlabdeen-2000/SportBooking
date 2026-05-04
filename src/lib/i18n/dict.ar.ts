import type { Dict } from "@/lib/i18n/dict.en";

// Arabic translations. Kuwaiti Arabic is conversational MSA; we keep
// the copy crisp and avoid colloquialisms so it reads as a polished
// brand voice rather than a chat message.
export const ar: Dict = {
  common: {
    skip: "تخطّي",
    book_a_court: "احجز ملعب",
    sign_in: "تسجيل الدخول",
    sign_out: "تسجيل الخروج",
    sign_up: "إنشاء حساب",
    home: "الرئيسية",
    back: "رجوع",
    cancel: "إلغاء",
    confirm: "تأكيد",
    save: "حفظ",
  },
  header: {
    call_us: "اتصل بنا",
    account: "حسابي",
  },
  welcome: {
    eyebrow: "سماش كورتس · السالمية",
    headline_part1: "مرحباً بك في",
    headline_part2: "سماش كورتس",
    sub: "اختر الملعب، اختر الوقت، وستلعب خلال أقل من دقيقة.",
    cta: "هيا نلعب!",
  },
  hero: {
    badge: "مفتوح يومياً · 8 صباحاً – 11 مساءً",
    headline_part1: "احجز ملعبك.",
    headline_part2: "العب اليوم.",
    sub: "سماش كورتس الكويت — ملاعب بادل وتنس وكرة قدم بمستوى احترافي في السالمية. اختر الوقت، أدخل اسمك، وستلعب خلال أقل من دقيقة.",
    cta_primary: "احجز ملعب",
    cta_secondary: "لدي حساب",
    pill_padel: "بادل",
    pill_tennis: "تنس",
    pill_football: "كرة قدم",
    pill_open_late: "حتى 11 مساءً",
  },
  stats: {
    courts: "ملاعب احترافية",
    booking_window: "نافذة الحجز",
    open_per_day: "ساعات العمل",
    avg_booking: "متوسط الحجز",
    suffix_days: " يوم",
    suffix_hours: " ساعة",
    suffix_seconds: " ثانية",
  },
  why: {
    title: "لماذا سماش",
    instant_title: "حجز فوري",
    instant_body: "تأكيد خلال أقل من دقيقة.",
    pro_title: "ملاعب بمستوى احترافي",
    pro_body: "صيانة يومية من فريقنا.",
    plan_title: "احجز قبل 14 يوماً",
    plan_body: "خطّط لأسبوعك بثقة.",
  },
  courts: {
    title: "ملاعبنا",
    subtitle: "اختر ملعباً — واحجز الوقت المتاح القادم.",
    capacity: "حتى {count} لاعبين",
    price_per_hour: "ابتداءً من {price} / ساعة",
    new: "جديد",
    loading: "جارٍ تحميل الملاعب…",
    loading_sub:
      "نواجه مشكلة في جلب الملاعب الآن. حاول مرة أخرى بعد قليل.",
  },
  how: {
    title: "كيف يعمل",
    step1_title: "اختر الملعب والوقت",
    step1_body: "اختر رياضتك والوقت المتاح.",
    step2_title: "أدخل اسمك ورقمك",
    step2_body: "نموذج سريع، بدون حساب.",
    step3_title: "احضر والعب",
    step3_body: "ستصلك رسالة تأكيد على هاتفك.",
  },
  final_cta: {
    title: "جاهز للعب؟",
    sub: "احجز ملعبك خلال أقل من دقيقة.",
    cta: "احجز ملعب",
  },
  footer: {
    address: "قطعة 10، السالمية، الكويت",
    rights: "© {year} سماش كورتس الكويت",
  },
};
