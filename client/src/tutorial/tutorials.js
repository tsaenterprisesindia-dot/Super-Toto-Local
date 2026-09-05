// AI video tutorial content. Each tour is a sequence of steps:
//   route     -> the URL to visit for this step (navigated automatically)
//   highlight -> the element to ring with the AI spotlight ([data-tt="..."])
//   text      -> what the AI narrator says aloud on this step
//   wait      -> extra pause (ms) after narration before auto-advancing
export const TOURS = [
  {
    id: 'welcome',
    icon: '👋',
    title: 'Welcome tour',
    desc: 'How the app is organised — landing, log in and sign up.',
    show: () => true,
    steps: [
      {
        route: '/',
        highlight: '[data-tt="landing-cta"]',
        text: 'Welcome to Super Toto Local. This is the landing page. Use Get started to enter the app, or log in if you already have an account.',
      },
      {
        route: '/',
        highlight: '[data-tt="landing-features"]',
        text: 'These cards explain everything the platform does. Book a toto in seconds, track it live, drive, manage, pay, and rate your trips. Click any card to jump straight into that feature.',
      },
      {
        route: '/login',
        highlight: '.auth-card',
        text: 'Here is the log in screen. Choose your role at the top — rider, driver, or admin — then enter your email and password.',
        wait: 1400,
      },
      {
        route: '/register',
        highlight: '.auth-card',
        text: 'New here? The sign-up screen lets you register as a rider or a driver. Enter your details, verify the OTP, and accept the terms to continue.',
        wait: 1400,
      },
      {
        route: '/login',
        highlight: '.auth-card',
        text: 'You can try the demo rider account: rider at supertoto dot local, with the password shown on the built-in demo card. That is the end of the welcome tour.',
        wait: 1600,
      },
    ],
  },
  {
    id: 'rider',
    icon: '📱',
    title: 'Book a ride',
    desc: 'Reserve or share a toto: pickup, drop, fare, then request.',
    show: (u) => u?.role === 'rider',
    steps: [
      {
        route: '/ride',
        highlight: '[data-tt="rider-route"]',
        text: 'This is the booking screen. Start by choosing pickup and drop — pick a saved place or tap to set them on the map.',
      },
      {
        route: '/ride',
        highlight: '[data-tt="rider-fare"]',
        text: 'As soon as both points are set, you see the live fare estimate. It includes base fare, distance, time, luggage, surge, and GST, and the distance and ETA come from real road routing.',
        wait: 900,
      },
      {
        route: '/ride',
        highlight: '[data-tt="rider-actions"]',
        text: 'Choose how to travel: Reserve the whole toto, or book shared seats to split the fare across riders. Shared is greener and cheaper per seat.',
        wait: 1000,
      },
      {
        route: '/ride',
        highlight: '[data-tt="rider-book"]',
        text: 'When you are happy with the fare, tap the book button. A nearby driver accepts, you see live tracking on the map, and you can pay by UPI, cash, card, or wallet after the trip.',
        wait: 1400,
      },
    ],
  },
  {
    id: 'driver',
    icon: '🛺',
    title: 'Driver shift',
    desc: 'Go online, accept requests, complete trips and get paid.',
    show: (u) => u?.role === 'driver',
    steps: [
      {
        route: '/driver',
        highlight: '[data-tt="driver-online"]',
        text: 'Welcome to the driver console. Use this switch to go online and start receiving ride requests near you. Stay online to keep earning.',
      },
      {
        route: '/driver',
        highlight: '[data-tt="driver-stats"]',
        text: 'Your dashboard shows exactly what you receive after commission, how many trips you completed, and your rating. Cash from completed trips also appears here.',
        wait: 1000,
      },
      {
        route: '/driver',
        highlight: '[data-tt="driver-accept"]',
        text: 'When a rider requests a ride, it appears with the fare and trip details. Review it, then accept to pick up the rider, or decline if you cannot.',
        wait: 900,
      },
      {
        route: '/driver/documents',
        highlight: '[data-tt="driver-docs"]',
        text: 'Keep your documents up to date here. You need a driving licence, vehicle registration, permits, insurance, and a face ID enrolment for verification.',
        wait: 1100,
      },
      {
        route: '/driver/vehicle',
        highlight: '[data-tt="driver-vehicle"]',
        text: 'Finally, manage your vehicle details — type, number, and capacity. That is your full driver flow.',
        wait: 900,
      },
    ],
  },
  {
    id: 'admin',
    icon: '📊',
    title: 'Admin control center',
    desc: 'Approve drivers, monitor rides, revenue and compliance.',
    show: (u) => u?.role === 'admin',
    steps: [
      {
        route: '/admin',
        highlight: '[data-tt="admin-nav"]',
        text: 'Welcome to the admin console. Everything is organised from this sidebar: drivers, riders, rides, reports, cash settlement, promos, fares, safety, and settings.',
      },
      {
        route: '/admin/drivers',
        highlight: '[data-tt="admin-main"]',
        text: 'Approve new drivers, review their documents, and manage suspensions or warnings right from this list.',
        wait: 900,
      },
      {
        route: '/admin/rides',
        highlight: '[data-tt="admin-main"]',
        text: 'Monitor every ride in real time — status, driver, rider, and fare — and keep an eye on anything unexpected.',
        wait: 900,
      },
      {
        route: '/admin/reports',
        highlight: '[data-tt="admin-main"]',
        text: 'Track revenue and fares here. Export trips, review fare breakdowns, and stay on top of the platform finances.',
        wait: 1100,
      },
    ],
  },
];

// Which tours a user may watch, in display order.
export function availableTours(user) {
  return TOURS.filter((t) => t.show(user));
}