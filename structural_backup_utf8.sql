--
-- PostgreSQL database dump
--

\restrict ktPfm9akDvvXnu4h3zNGs45jVh6xApd0YgtAdgcHsrCm80i6yioG1bluLoALQCC

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public."User" DROP CONSTRAINT "User_branchId_fkey";
ALTER TABLE ONLY public."Reservation" DROP CONSTRAINT "Reservation_branchId_fkey";
ALTER TABLE ONLY public."Order" DROP CONSTRAINT "Order_branchId_fkey";
ALTER TABLE ONLY public."Inventory" DROP CONSTRAINT "Inventory_branchId_fkey";
ALTER TABLE ONLY public."Delivery" DROP CONSTRAINT "Delivery_branchId_fkey";
DROP INDEX public."User_email_key";
DROP INDEX public."Inventory_branchId_itemName_key";
DROP INDEX public."Branch_name_key";
ALTER TABLE ONLY public._prisma_migrations DROP CONSTRAINT _prisma_migrations_pkey;
ALTER TABLE ONLY public."User" DROP CONSTRAINT "User_pkey";
ALTER TABLE ONLY public."Reservation" DROP CONSTRAINT "Reservation_pkey";
ALTER TABLE ONLY public."Order" DROP CONSTRAINT "Order_pkey";
ALTER TABLE ONLY public."Inventory" DROP CONSTRAINT "Inventory_pkey";
ALTER TABLE ONLY public."Delivery" DROP CONSTRAINT "Delivery_pkey";
ALTER TABLE ONLY public."Branch" DROP CONSTRAINT "Branch_pkey";
ALTER TABLE public."User" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public."Reservation" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public."Order" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public."Inventory" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public."Delivery" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public."Branch" ALTER COLUMN id DROP DEFAULT;
DROP TABLE public._prisma_migrations;
DROP SEQUENCE public."User_id_seq";
DROP TABLE public."User";
DROP SEQUENCE public."Reservation_id_seq";
DROP TABLE public."Reservation";
DROP SEQUENCE public."Order_id_seq";
DROP TABLE public."Order";
DROP SEQUENCE public."Inventory_id_seq";
DROP TABLE public."Inventory";
DROP SEQUENCE public."Delivery_id_seq";
DROP TABLE public."Delivery";
DROP SEQUENCE public."Branch_id_seq";
DROP TABLE public."Branch";
DROP TYPE public."Role";
DROP TYPE public."OrderStatus";
--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'READY',
    'COMPLETED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'HQ_MANAGER',
    'BRANCH_MANAGER',
    'CHEF',
    'WAITER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Branch" (
    id integer NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Branch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Branch_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Branch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Branch_id_seq" OWNED BY public."Branch".id;


--
-- Name: Delivery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Delivery" (
    id integer NOT NULL,
    supplier text NOT NULL,
    details text NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "branchId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Delivery_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Delivery_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Delivery_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Delivery_id_seq" OWNED BY public."Delivery".id;


--
-- Name: Inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Inventory" (
    id integer NOT NULL,
    "itemName" text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    "branchId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    category text DEFAULT 'Steaks'::text NOT NULL,
    "desc" text DEFAULT ''::text NOT NULL,
    emoji text DEFAULT '­ƒÑ®'::text NOT NULL,
    price double precision DEFAULT 0.0 NOT NULL,
    "imageUrl" text
);


--
-- Name: Inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Inventory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Inventory_id_seq" OWNED BY public."Inventory".id;


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id integer NOT NULL,
    "tableNumber" integer NOT NULL,
    details text NOT NULL,
    "totalPrice" double precision DEFAULT 0.0 NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    "branchId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Order_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Order_id_seq" OWNED BY public."Order".id;


--
-- Name: Reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Reservation" (
    id integer NOT NULL,
    "customerName" text NOT NULL,
    "customerContact" text NOT NULL,
    "tableNumber" integer NOT NULL,
    "reservedFor" timestamp(3) without time zone NOT NULL,
    "branchId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "arrivedAt" timestamp(3) without time zone,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: Reservation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Reservation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Reservation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Reservation_id_seq" OWNED BY public."Reservation".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "branchId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: Branch id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch" ALTER COLUMN id SET DEFAULT nextval('public."Branch_id_seq"'::regclass);


--
-- Name: Delivery id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delivery" ALTER COLUMN id SET DEFAULT nextval('public."Delivery_id_seq"'::regclass);


--
-- Name: Inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Inventory" ALTER COLUMN id SET DEFAULT nextval('public."Inventory_id_seq"'::regclass);


--
-- Name: Order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order" ALTER COLUMN id SET DEFAULT nextval('public."Order_id_seq"'::regclass);


--
-- Name: Reservation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reservation" ALTER COLUMN id SET DEFAULT nextval('public."Reservation_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Branch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Branch" (id, name, location, "createdAt", "updatedAt") FROM stdin;
1	Steakz London	London	2026-05-26 18:57:00.271	2026-05-26 18:57:00.271
7	Steakz Birmingham	Birmingham	2026-05-26 20:39:23.116	2026-05-26 20:39:23.116
8	Manchester Steakz	Manchester	2026-06-02 13:58:25.428	2026-06-02 13:58:25.428
9	Liverpool Steakz	Liverpool	2026-06-02 13:58:38.256	2026-06-02 13:58:38.256
10	Glasgow Steakz	Glasgow	2026-06-02 13:58:49.882	2026-06-02 13:58:49.882
11	[DECOMMISSIONED] test (1780432667790)	test	2026-06-02 20:37:04.569	2026-06-02 20:37:47.792
\.


--
-- Data for Name: Delivery; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Delivery" (id, supplier, details, "receivedAt", "branchId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Inventory" (id, "itemName", quantity, "branchId", "createdAt", "updatedAt", category, "desc", emoji, price, "imageUrl") FROM stdin;
80	Signature Tomahawk Reserve	50	1	2026-06-01 16:29:36.384	2026-06-01 16:29:36.384	Steaks	900g bone-in prime beef steak, flame grilled and served with roasted garlic butter and house seasoning.	­ƒÑ®	42.95	\N
81	Royal Wagyu Sirloin	50	1	2026-06-01 16:30:00.682	2026-06-01 16:30:00.682	Steaks	Premium marbled Wagyu sirloin cooked to your preference with smoked sea salt and herb butter.	­ƒÑ®	34.5	\N
82	Gold Crown Porterhouse	50	7	2026-06-02 14:48:42.674	2026-06-02 14:48:42.674	Steaks	Large premium porterhouse steak combining tender fillet and rich striploin, finished with garlic rosemary butter.	­ƒÑ®	44.95	\N
84	Steakz Filet Mignon Deluxe	50	1	2026-06-02 14:51:19.364	2026-06-02 14:51:19.364	Steaks	Tender center-cut fillet served with truffle mashed potatoes and red wine reduction sauce.	­ƒÑ®	31.95	\N
85	London Smokehouse T-Bone	50	1	2026-06-02 14:51:42.551	2026-06-02 14:51:42.551	Steaks	Large T-bone steak with signature smoke seasoning, grilled vegetables, and peppercorn sauce.	­ƒÑ®	38.95	\N
87	The Mayfair Chateaubriand (For Two)	50	1	2026-06-02 15:09:20.826	2026-06-02 15:09:20.826	Steaks	Sharing cut of premium fillet steak carved tableside style with signature sauces and sides.	­ƒÑ®	69.95	\N
107	Truffle Beef Carpaccio	50	1	2026-06-03 07:57:14.394	2026-06-03 08:01:26.169	Starters	Thinly sliced raw beef fillet with truffle oil, rocket, parmesan shavings, and lemon zest.	­ƒÑ®	11.5	/uploads/dishes/dish-1780473686134-ga4a8.png
109	Charred Garlic Butter Broccolini	50	1	2026-06-03 07:58:09.97	2026-06-03 08:03:11.65	Sides	Lightly grilled broccolini finished with warm garlic butter and sea salt flakes.	­ƒÑ®	4.95	/uploads/dishes/dish-1780473791602-4s1a8.png
106	Steakz Bone Marrow Toast	49	1	2026-06-03 07:56:42.434	2026-06-03 08:30:04.349	Starters	Roasted beef bone marrow served on toasted sourdough with parsley, sea salt, and caramelised onion jam.	­ƒÑ®	9.95	/uploads/dishes/dish-1780473631589-e6y8g.png
108	Black Truffle Parmesan Fries	49	1	2026-06-03 07:57:42.95	2026-06-03 08:30:04.351	Sides	Crispy fries tossed in truffle oil, grated parmesan, and fine herbs.	­ƒÑ®	5.95	/uploads/dishes/dish-1780473739137-i6kox.png
83	Black Angus Ribeye Supreme	7	1	2026-06-02 14:51:01.956	2026-06-03 08:53:01.967	Steaks	300g aged Black Angus ribeye with rich marbling, grilled over open flame for deep flavor.	­ƒÑ®	29.95	/uploads/dishes/dish-1780469484204-we7ii.png
86	Bourbon Glazed Striploin	48	1	2026-06-02 15:09:03.902	2026-06-03 08:53:01.971	Steaks	Juicy striploin steak brushed with a smoky bourbon glaze and served with crispy shallots.	­ƒÑ®	28.95	/uploads/dishes/dish-1780469631820-9m0t8.png
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Order" (id, "tableNumber", details, "totalPrice", "isPaid", status, "branchId", "createdAt", "updatedAt") FROM stdin;
23	5	1x Black Angus Ribeye Supreme, 1x Bourbon Glazed Striploin	66.26	t	PENDING	1	2026-06-03 08:53:01.974	2026-06-03 08:53:02.024
22	5	1x Black Angus Ribeye Supreme, 1x Bourbon Glazed Striploin, 1x Steakz Bone Marrow Toast, 1x Black Truffle Parmesan Fries	84.15	t	COMPLETED	1	2026-06-03 08:30:04.354	2026-06-03 08:30:41.614
\.


--
-- Data for Name: Reservation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Reservation" (id, "customerName", "customerContact", "tableNumber", "reservedFor", "branchId", "createdAt", "updatedAt", "arrivedAt", status) FROM stdin;
1	Emil 	+44 555 555 555 	1	2026-06-10 16:20:00	1	2026-05-26 20:08:07.183	2026-06-03 07:53:33.252	2026-06-03 07:53:33.249	arrived
3	ffff	ffdfdf	4	2026-11-15 18:00:00	1	2026-06-03 07:36:07.355	2026-06-03 07:53:40.052	2026-06-03 07:53:40.05	arrived
2	wew	weqwe	7	2026-11-15 18:00:00	1	2026-06-03 07:17:10.567	2026-06-03 07:53:46.821	2026-06-03 07:53:46.819	arrived
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, password, role, "isActive", "branchId", "createdAt", "updatedAt") FROM stdin;
1	Steakz Technical Admin	admin@steakz.co.uk	$2b$10$ZB865.f11rgqSpeZ2nbf5OEFZHe36lUXPAyohh9jKOPe866ubFVLG	ADMIN	t	\N	2026-05-26 17:51:08.877	2026-05-26 17:51:08.877
2	Mark Key	m.key@steakz.com	$2b$10$A4i2FVvNsRsoCy0QK7BiBukZFEVYz5O.eQNQX9afybGidImLYu.9.	HQ_MANAGER	t	\N	2026-05-26 19:15:00.582	2026-05-26 19:15:00.582
3	Kai Stone	k.stone@steakz.com	$2b$10$GxwCdeb2MpENFK1ELQV2MuhPmLgJBMIqLLYT7L6uYxDyeXk.p/GFG	BRANCH_MANAGER	t	1	2026-05-26 19:27:39.077	2026-05-26 19:49:38.615
4	Nill Klin	n.klin@steakz.com	$2b$10$LQUT9FvedB6M/p/3OdQS8uzmJlDXIFmaQfz366c5uwovSwyniapSC	CHEF	t	1	2026-05-26 19:36:16.47	2026-05-26 19:49:38.615
5	Kate Row	k.row@steakz.com	$2b$10$YpG4xbWcjoY7fZx7j8eMUOtTZ.22kdn3dwSaJDzd8z2SwAMyvLp.y	WAITER	t	1	2026-05-26 19:55:36.255	2026-05-26 19:55:36.255
6	James Smith	j.smith@steakz.com	$2b$10$5xISPCHAnY9TWzEQYyGsN.HcJFgZYOMe0sS/uAd1nebjIZEQoVu02	BRANCH_MANAGER	t	7	2026-06-02 14:12:43.712	2026-06-02 14:24:40.5
7	Emma Brown	e.brown@steakz.com	$2b$10$RyBFt.GpTJIYB6b8tpuV7.DJnTVEM9Ls9WaBwHkontfsxTKhOUPN.	BRANCH_MANAGER	t	8	2026-06-02 14:29:41.605	2026-06-02 14:29:47.823
8	Daniel Wilson	d.wilson@steakz.com	$2b$10$yVKQm9OlaqG0IK5hN1.voOpeeN1T6foGsGVd.OBewbmLbaLAYhiKW	BRANCH_MANAGER	t	9	2026-06-02 14:36:35.943	2026-06-02 14:36:39.382
9	Sarah Taylor	s.taylor@steakz.com	$2b$10$obwZU61FvEGj6Xi5Vc8tleAhRbr62RSzQhAxT44KsjpWHbEn.RbfO	BRANCH_MANAGER	t	10	2026-06-02 14:37:50.806	2026-06-02 14:37:58.738
10	Michael Carter	m.carter@steakz.com	$2b$10$5i7afhImpp6fM7DN26COt.MZTTCxVoU03g.W6Fvgm6Ns9.czAHTg2	CHEF	t	7	2026-06-02 15:39:15.482	2026-06-02 15:39:15.482
12	Alex Turner	a.turner@steakz.com	$2b$10$3w2Y121IGCmYBujJSLPdR.8TWXHMyTLZLjsfv3g8NbphxSJptkmt2	WAITER	t	7	2026-06-02 18:46:30.534	2026-06-02 18:46:30.534
13	test	test@test	$2b$10$YYunp4YaL2CrhBn8ZYQSdeqPtjYDyq4W/G7zmxzI3uYPXQ5iiOFD6	HQ_MANAGER	f	\N	2026-06-02 20:36:04.979	2026-06-02 20:36:19.44
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
893fea46-31bd-49b3-b8bd-c9ff25f0e00b	b46f1332bf892762e6ba9c6f3751176933f72678cdaea2a8b794b023000cfeb6	2026-05-26 12:42:21.057272+00	20260526124220_init_steakz_schema	\N	\N	2026-05-26 12:42:20.947408+00	1
3cc8dfc4-b91d-429b-bd08-cd3686f6b676	4b7335fa05daafaf90826da7912908f213b1c61dc6b0604002a4b95f249fd981	2026-06-01 09:12:24.201047+00	20260601091224_add_menu_details_to_inventory	\N	\N	2026-06-01 09:12:24.121483+00	1
57b852d5-891b-46aa-a2d9-02840bf323f9	80ac6eff37a30f81fa169aa106ce59307bef20e352f9a44316eaa680ceed89f6	2026-06-03 06:24:27.222635+00	20260603062427_imageupload	\N	\N	2026-06-03 06:24:27.193752+00	1
4af8d054-e6d4-45e5-b5bd-38f77d2d6c50	05264979b8610f4f1fff4394a37aa202e3186d7596b07f53d27d914abd6bed53	2026-06-03 07:28:55.189669+00	20260603072855_add_reservation_status	\N	\N	2026-06-03 07:28:55.117692+00	1
\.


--
-- Name: Branch_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Branch_id_seq"', 11, true);


--
-- Name: Delivery_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Delivery_id_seq"', 1, false);


--
-- Name: Inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Inventory_id_seq"', 113, true);


--
-- Name: Order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Order_id_seq"', 23, true);


--
-- Name: Reservation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Reservation_id_seq"', 3, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."User_id_seq"', 13, true);


--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: Delivery Delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delivery"
    ADD CONSTRAINT "Delivery_pkey" PRIMARY KEY (id);


--
-- Name: Inventory Inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Inventory"
    ADD CONSTRAINT "Inventory_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Reservation Reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reservation"
    ADD CONSTRAINT "Reservation_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Branch_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_name_key" ON public."Branch" USING btree (name);


--
-- Name: Inventory_branchId_itemName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Inventory_branchId_itemName_key" ON public."Inventory" USING btree ("branchId", "itemName");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Delivery Delivery_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Delivery"
    ADD CONSTRAINT "Delivery_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Inventory Inventory_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Inventory"
    ADD CONSTRAINT "Inventory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Reservation Reservation_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reservation"
    ADD CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict ktPfm9akDvvXnu4h3zNGs45jVh6xApd0YgtAdgcHsrCm80i6yioG1bluLoALQCC

