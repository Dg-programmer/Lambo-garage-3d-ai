export const MODEL_SOURCE = 'https://www.lamborghini.com/en-en/models/huracan/huracan-sto';

export const ASSEMBLIES = [
  {
    id: 'front', name: 'Front bodywork', label: 'Cofango', anchor: [0, .61, 1.69], yaw: .48, pitch: .43,
    description: 'The carbon-fiber Cofango integrates the nose, hood, and front fenders. Its openings manage air around the radiator and front wheels.',
    source: 'https://www.lamborghini.com/en-en/news/huracan-sto-the-cofango',
    components: [
      { id: 'shell', name: 'Cofango shell', text: 'The hood and fenders are molded into one lightweight piece. The cutaway shows that continuous shell as one component.' },
      { id: 'duct', name: 'Radiator duct', text: 'The duct channels incoming air across the radiator fins and out through the hood openings. The fins increase the surface area available to transfer heat to the passing air.' },
      { id: 'louvers', name: 'Fender louvers', text: 'Vents above the front tires let pressurized air escape the wheel housings, contributing to front downforce.' },
      { id: 'splitter', name: 'Front splitter', text: 'The low leading edge divides airflow. The air directed below the car feeds the underbody and rear diffuser.' },
      { id: 'headlamps', name: 'Headlamp units', text: 'Look for the projector optics and angular LED guides behind the molded lens. The projectors shape the forward beam, and the light guides form the running-light signature.' },
    ],
  },
  {
    id: 'engine', name: 'V10 powertrain', label: 'Engine & transmission', anchor: [0, .72, -1.01], yaw: -2.44, pitch: .55,
    description: 'The 5.2-liter naturally aspirated V10 sits behind the cockpit and sends power to the rear wheels. Lamborghini rates it at 640 CV at 8,000 rpm.',
    source: MODEL_SOURCE,
    components: [
      { id: 'intake', name: 'Intake plenum', text: 'The plenum and its runners distribute incoming air to both cylinder banks. The V10 draws air without a turbocharger.' },
      { id: 'heads', name: 'Cylinder heads', text: 'Each head serves a bank of five cylinders. The row of ports carries air and exhaust, while the valves and camshafts in the heads time the flow.' },
      { id: 'block', name: 'Engine block', text: 'Five bores on each side of the V guide the pistons. The small passages around the cylinder liners carry coolant. Below the bores, the connecting rods and crankshaft turn piston travel into rotation.' },
      { id: 'transmission', name: 'Transmission', text: 'The dual-clutch transmission changes the ratio between engine speed and rear-wheel speed. Its two clutches allow one ratio to be prepared while the other is engaged.' },
      { id: 'headers', name: 'Exhaust headers', text: 'Individual runners carry exhaust from each cylinder to a collector. The flanges at the ends provide mounting faces for the heads and the downstream exhaust.' },
    ],
  },
  {
    id: 'wheel', name: 'Wheel & brakes', label: 'CCM-R assembly', anchor: [.948, .34, 1.172], yaw: 1.19, pitch: .20,
    description: 'The track-focused wheel surrounds a Brembo CCM-R carbon-ceramic brake disc. The system is designed to maintain consistent braking during repeated stops.',
    source: 'https://www.lamborghini.com/en-en/node/1028',
    components: [
      { id: 'tyre', name: 'Tire', text: 'The tire transfers acceleration, cornering, and braking forces through its contact patch. The STO was developed with track-oriented Bridgestone tires.' },
      { id: 'rim', name: '20-inch rim', text: 'The thin spokes transmit load between the hub and rim while leaving airflow around the brake. Lamborghini offered 20-inch magnesium wheels for the STO.' },
      { id: 'disc', name: 'CCM-R brake disc', text: 'The center bell bolts to the outer carbon-ceramic friction ring. The pads clamp that ring, while ventilation passages and incoming air help remove heat.' },
      { id: 'caliper', name: 'Caliper and pads', text: 'Follow the brake line to the stationary caliper. Hydraulic pressure pushes the pistons outward to press the pads against both faces of the rotating disc.' },
      { id: 'hub', name: 'Hub and central fastener', text: 'The hub locates the wheel on the axle and transmits torque. The center fastener secures the wheel to the hub.' },
    ],
  },
  {
    id: 'aero', name: 'Rear aero', label: 'Wing & diffuser', anchor: [0, 1.15, -2.06], yaw: 2.57, pitch: .34,
    description: 'The slotted rear wing and underbody diffuser manage airflow at the rear. The wing has three manually adjustable settings for aerodynamic balance.',
    source: MODEL_SOURCE,
    components: [
      { id: 'main-plane', name: 'Main wing plane', text: 'The main airfoil directs airflow so the wing creates a downward force on the rear of the car at speed.' },
      { id: 'flap', name: 'Adjustable wing element', text: 'Changing the element’s angle changes the balance of downforce and drag. The STO offers three manual wing settings.' },
      { id: 'stays', name: 'Wing supports', text: 'The uprights hold the wing above the rear bodywork and transfer its aerodynamic load into the mounting structure.' },
      { id: 'endplates', name: 'End plates', text: 'The vertical panels at the wing tips help manage air moving around the ends of the wing.' },
      { id: 'diffuser', name: 'Rear diffuser', text: 'The expanding underbody channels guide the airflow out behind the car. Vertical strakes keep the channels separated.' },
    ],
  },
  {
    id: 'cockpit', name: 'Cockpit', label: 'Driver controls', anchor: [.06, .94, .33], yaw: .81, pitch: .57,
    description: 'The driver’s controls and displays sit around a lightweight, race-inspired cabin. Lamborghini integrated the STO telemetry into the instruments and center display.',
    source: MODEL_SOURCE,
    components: [
      { id: 'steering', name: 'Steering wheel', text: 'The wheel transmits steering inputs and places driving controls within reach. The STO uses a fixed steering ratio.' },
      { id: 'cluster', name: 'Instrument display', text: 'The driver display presents speed, engine speed, and vehicle information. The connected telemetry system can also display track data.' },
      { id: 'paddles', name: 'Shift paddles', text: 'The + paddle requests an upshift and the − paddle requests a downshift. Both sit behind the rim so the driver can keep a hand on the wheel.' },
      { id: 'seat', name: 'Bucket seat', text: 'The shaped shell and side bolsters help keep the driver in place under braking and cornering. The model simplifies the padding and shell construction.' },
      { id: 'harness', name: 'Restraint assembly', text: 'The shoulder and lap straps meet at the center buckle. The adjusters set strap length so the restraint can hold the driver securely against the seat.' },
    ],
  },
  {
    id: 'suspension', name: 'Suspension', label: 'Spring, damper & links', anchor: [-.87, .45, -1.43], yaw: -2.12, pitch: .35,
    description: 'The suspension keeps the wheel controlled as it moves over the road. This cutaway explains the roles of the spring, damper, control arms, and wheel carrier.',
    source: MODEL_SOURCE,
    components: [
      { id: 'spring', name: 'Coil spring', text: 'Upper and lower seats locate the ends of the coil. The spring compresses as the wheel moves upward and returns that energy as it extends.' },
      { id: 'damper', name: 'Damper body and shaft', text: 'The damper slows the spring’s motion and helps the wheel settle. Its shaft moves inside the body as the suspension travels.' },
      { id: 'arms', name: 'Control arms', text: 'Upper and lower links guide the wheel carrier and determine how the wheel tilts as the suspension moves.' },
      { id: 'upright', name: 'Wheel carrier', text: 'The upright connects the control arms to the hub and maintains the alignment of the wheel and brake assembly.' },
      { id: 'link', name: 'Anti-roll bar link', text: 'The link transfers suspension movement to the anti-roll bar. The bar resists the difference in travel between the two sides during cornering.' },
    ],
  },
];

export const PART_COUNT = ASSEMBLIES.reduce((count, part) => count + part.components.length, 0);
