--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (84bec44)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg120+1)

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

--
-- Name: RepaymentType; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."RepaymentType" AS ENUM (
    'REGULAR',
    'INTEREST_ONLY',
    'PARTIAL'
);


ALTER TYPE public."RepaymentType" OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Auction; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Auction" (
    id integer NOT NULL,
    "chitFundId" integer NOT NULL,
    month integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "winnerId" integer NOT NULL,
    amount double precision NOT NULL,
    "lowestBid" double precision,
    "highestBid" double precision,
    "numberOfBidders" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    disbursed_by_id integer,
    entered_by_id integer,
    "transactionId" integer
);


ALTER TABLE public."Auction" OWNER TO neondb_owner;

--
-- Name: Auction_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Auction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Auction_id_seq" OWNER TO neondb_owner;

--
-- Name: Auction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Auction_id_seq" OWNED BY public."Auction".id;


--
-- Name: ChitFund; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ChitFund" (
    id integer NOT NULL,
    name text NOT NULL,
    "totalAmount" double precision NOT NULL,
    "monthlyContribution" double precision NOT NULL,
    "firstMonthContribution" double precision,
    duration integer NOT NULL,
    "membersCount" integer NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "currentMonth" integer DEFAULT 1 NOT NULL,
    "nextAuctionDate" timestamp(3) without time zone,
    description text,
    "chitFundType" text DEFAULT 'Auction'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" integer NOT NULL
);


ALTER TABLE public."ChitFund" OWNER TO neondb_owner;

--
-- Name: ChitFundFixedAmount; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ChitFundFixedAmount" (
    id integer NOT NULL,
    "chitFundId" integer NOT NULL,
    month integer NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ChitFundFixedAmount" OWNER TO neondb_owner;

--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."ChitFundFixedAmount_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ChitFundFixedAmount_id_seq" OWNER TO neondb_owner;

--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."ChitFundFixedAmount_id_seq" OWNED BY public."ChitFundFixedAmount".id;


--
-- Name: ChitFund_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."ChitFund_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ChitFund_id_seq" OWNER TO neondb_owner;

--
-- Name: ChitFund_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."ChitFund_id_seq" OWNED BY public."ChitFund".id;


--
-- Name: Contribution; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Contribution" (
    id integer NOT NULL,
    amount double precision NOT NULL,
    month integer NOT NULL,
    "paidDate" timestamp(3) without time zone NOT NULL,
    "memberId" integer NOT NULL,
    "chitFundId" integer NOT NULL,
    balance double precision DEFAULT 0 NOT NULL,
    "balancePaymentDate" timestamp(3) without time zone,
    "balancePaymentStatus" text DEFAULT 'Pending'::text,
    "actualBalancePaymentDate" timestamp(3) without time zone,
    notes text,
    collected_by_id integer,
    entered_by_id integer,
    "createdById" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "transactionId" integer
);


ALTER TABLE public."Contribution" OWNER TO neondb_owner;

--
-- Name: Contribution_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Contribution_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Contribution_id_seq" OWNER TO neondb_owner;

--
-- Name: Contribution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Contribution_id_seq" OWNED BY public."Contribution".id;


--
-- Name: EmailLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."EmailLog" (
    id integer NOT NULL,
    "emailType" text NOT NULL,
    period text NOT NULL,
    "sentDate" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    recipients text NOT NULL,
    "fileName" text,
    "isRecovery" boolean DEFAULT false NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."EmailLog" OWNER TO neondb_owner;

--
-- Name: EmailLog_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."EmailLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EmailLog_id_seq" OWNER TO neondb_owner;

--
-- Name: EmailLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."EmailLog_id_seq" OWNED BY public."EmailLog".id;


--
-- Name: GlobalMember; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."GlobalMember" (
    id integer NOT NULL,
    name text NOT NULL,
    contact text NOT NULL,
    email text,
    address text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" integer NOT NULL
);


ALTER TABLE public."GlobalMember" OWNER TO neondb_owner;

--
-- Name: GlobalMember_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."GlobalMember_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."GlobalMember_id_seq" OWNER TO neondb_owner;

--
-- Name: GlobalMember_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."GlobalMember_id_seq" OWNED BY public."GlobalMember".id;


--
-- Name: Loan; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Loan" (
    id integer NOT NULL,
    "borrowerId" integer NOT NULL,
    "loanType" text NOT NULL,
    amount double precision NOT NULL,
    "interestRate" double precision NOT NULL,
    "documentCharge" double precision DEFAULT 0 NOT NULL,
    "currentMonth" integer DEFAULT 0 NOT NULL,
    "installmentAmount" double precision DEFAULT 0 NOT NULL,
    duration integer NOT NULL,
    "disbursementDate" timestamp(3) without time zone NOT NULL,
    "repaymentType" text NOT NULL,
    "remainingAmount" double precision NOT NULL,
    "overdueAmount" double precision DEFAULT 0 NOT NULL,
    "missedPayments" integer DEFAULT 0 NOT NULL,
    "nextPaymentDate" timestamp(3) without time zone,
    status text DEFAULT 'Active'::text NOT NULL,
    purpose text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" integer NOT NULL,
    disbursed_by_id integer,
    entered_by_id integer,
    "transactionId" integer
);


ALTER TABLE public."Loan" OWNER TO neondb_owner;

--
-- Name: Loan_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Loan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Loan_id_seq" OWNER TO neondb_owner;

--
-- Name: Loan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Loan_id_seq" OWNED BY public."Loan".id;


--
-- Name: Member; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Member" (
    id integer NOT NULL,
    "globalMemberId" integer NOT NULL,
    "chitFundId" integer NOT NULL,
    "joinDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "auctionWon" boolean DEFAULT false NOT NULL,
    "auctionMonth" integer,
    contribution double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Member" OWNER TO neondb_owner;

--
-- Name: Member_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Member_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Member_id_seq" OWNER TO neondb_owner;

--
-- Name: Member_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Member_id_seq" OWNED BY public."Member".id;


--
-- Name: Partner; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Partner" (
    id integer NOT NULL,
    name text NOT NULL,
    code text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" integer NOT NULL
);


ALTER TABLE public."Partner" OWNER TO neondb_owner;

--
-- Name: Partner_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Partner_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Partner_id_seq" OWNER TO neondb_owner;

--
-- Name: Partner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Partner_id_seq" OWNED BY public."Partner".id;


--
-- Name: PaymentSchedule; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."PaymentSchedule" (
    id integer NOT NULL,
    "loanId" integer NOT NULL,
    period integer NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    amount double precision NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    "actualPaymentDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PaymentSchedule" OWNER TO neondb_owner;

--
-- Name: PaymentSchedule_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."PaymentSchedule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PaymentSchedule_id_seq" OWNER TO neondb_owner;

--
-- Name: PaymentSchedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."PaymentSchedule_id_seq" OWNED BY public."PaymentSchedule".id;


--
-- Name: Repayment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Repayment" (
    id integer NOT NULL,
    amount double precision NOT NULL,
    "paidDate" timestamp(3) without time zone NOT NULL,
    period integer NOT NULL,
    "loanId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "paymentType" text NOT NULL,
    collected_by_id integer,
    "createdById" integer,
    entered_by_id integer,
    "transactionId" integer
);


ALTER TABLE public."Repayment" OWNER TO neondb_owner;

--
-- Name: Repayment_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Repayment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Repayment_id_seq" OWNER TO neondb_owner;

--
-- Name: Repayment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Repayment_id_seq" OWNED BY public."Repayment".id;


--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Transaction" (
    id integer NOT NULL,
    type text NOT NULL,
    amount double precision NOT NULL,
    from_partner text,
    to_partner text,
    action_performer text NOT NULL,
    entered_by text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" integer NOT NULL,
    from_partner_id integer,
    to_partner_id integer,
    "partnerBalance" double precision DEFAULT 0,
    "totalBalance" double precision DEFAULT 0
);


ALTER TABLE public."Transaction" OWNER TO neondb_owner;

--
-- Name: Transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."Transaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Transaction_id_seq" OWNER TO neondb_owner;

--
-- Name: Transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."Transaction_id_seq" OWNED BY public."Transaction".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO neondb_owner;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO neondb_owner;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Auction id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction" ALTER COLUMN id SET DEFAULT nextval('public."Auction_id_seq"'::regclass);


--
-- Name: ChitFund id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ChitFund" ALTER COLUMN id SET DEFAULT nextval('public."ChitFund_id_seq"'::regclass);


--
-- Name: ChitFundFixedAmount id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ChitFundFixedAmount" ALTER COLUMN id SET DEFAULT nextval('public."ChitFundFixedAmount_id_seq"'::regclass);


--
-- Name: Contribution id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution" ALTER COLUMN id SET DEFAULT nextval('public."Contribution_id_seq"'::regclass);


--
-- Name: EmailLog id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EmailLog" ALTER COLUMN id SET DEFAULT nextval('public."EmailLog_id_seq"'::regclass);


--
-- Name: GlobalMember id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."GlobalMember" ALTER COLUMN id SET DEFAULT nextval('public."GlobalMember_id_seq"'::regclass);


--
-- Name: Loan id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan" ALTER COLUMN id SET DEFAULT nextval('public."Loan_id_seq"'::regclass);


--
-- Name: Member id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Member" ALTER COLUMN id SET DEFAULT nextval('public."Member_id_seq"'::regclass);


--
-- Name: Partner id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partner" ALTER COLUMN id SET DEFAULT nextval('public."Partner_id_seq"'::regclass);


--
-- Name: PaymentSchedule id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PaymentSchedule" ALTER COLUMN id SET DEFAULT nextval('public."PaymentSchedule_id_seq"'::regclass);


--
-- Name: Repayment id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment" ALTER COLUMN id SET DEFAULT nextval('public."Repayment_id_seq"'::regclass);


--
-- Name: Transaction id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Transaction" ALTER COLUMN id SET DEFAULT nextval('public."Transaction_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Auction; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Auction" (id, "chitFundId", month, date, "winnerId", amount, "lowestBid", "highestBid", "numberOfBidders", notes, "createdAt", "updatedAt", disbursed_by_id, entered_by_id, "transactionId") FROM stdin;
1	2	1	2025-07-12 00:00:00	1	43000	\N	\N	\N	10000+19000(mano)+5500(arun loan)+8500(arul)	2025-07-12 11:52:15.018	2025-07-12 11:52:15.018	2	2	109
2	2	1	2025-07-12 00:00:00	10	43000	\N	\N	\N	Extra chit 	2025-07-13 14:43:26.347	2025-07-13 14:43:26.347	1	1	115
3	2	1	2025-08-07 00:00:00	9	43000	\N	\N	\N	30000 given at July, balance 13000 given at Aug	2025-08-07 03:22:56.549	2025-08-07 03:22:56.549	2	2	137
4	3	2	2025-08-13 00:00:00	13	25500	\N	\N	\N	\N	2025-08-13 06:22:04.332	2025-08-13 06:22:04.332	1	1	160
5	2	2	2025-08-17 00:00:00	16	43700	\N	\N	\N	chit amount paid 29300+old chit balance 9600+this month chit amount 4800= 43700	2025-08-19 07:15:08.19	2025-08-19 07:15:08.19	2	2	161
6	3	3	2025-09-10 00:00:00	14	26000	\N	\N	\N	\N	2025-09-10 14:06:34.712	2025-09-10 14:06:34.712	1	1	181
7	2	3	2025-09-17 00:00:00	5	44400	\N	\N	\N	30000 paid on 13th sept (Arul gpay)+ 9600 paid on 17 sept (Arul gpay) + manikandan seettu amount 4800 = 44400	2025-09-17 05:47:10.516	2025-09-17 05:47:10.516	2	2	195
\.


--
-- Data for Name: ChitFund; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ChitFund" (id, name, "totalAmount", "monthlyContribution", "firstMonthContribution", duration, "membersCount", status, "startDate", "currentMonth", "nextAuctionDate", description, "chitFundType", "createdAt", "updatedAt", "createdById") FROM stdin;
3	30k chit fund-07-25	30000	2850	3000	10	10	Active	2025-07-10 00:00:00	3	\N	\N	Fixed	2025-07-10 15:05:39.201	2025-09-10 14:06:35.611	1
4	30k chit fund-09-25	30000	2850	3000	10	10	Active	2025-09-10 00:00:00	1	\N	this chit fund is created only for sarath	Fixed	2025-09-14 03:13:04.71	2025-09-14 03:13:04.71	1
2	50k chit fund-07-25	50000	4800	5000	10	10	Active	2025-07-10 00:00:00	3	\N	\N	Fixed	2025-07-10 14:37:33.5	2025-09-17 05:47:11.628	1
5	50k chit fund-09-25	50000	4800	5000	10	1	Active	2025-09-10 00:00:00	1	\N	this chit is for Abiraman	Fixed	2025-09-26 05:15:26.658	2025-09-26 05:15:48.623	1
\.


--
-- Data for Name: ChitFundFixedAmount; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ChitFundFixedAmount" (id, "chitFundId", month, amount, "createdAt", "updatedAt") FROM stdin;
1	2	1	43000	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
2	2	2	43700	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
3	2	3	44400	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
4	2	4	45200	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
5	2	5	46000	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
6	2	6	46800	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
7	2	7	47600	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
8	2	8	48500	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
9	2	9	49300	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
10	2	10	50000	2025-07-10 14:37:33.823	2025-07-10 14:37:33.823
11	3	1	25000	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
12	3	2	25500	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
13	3	3	26000	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
14	3	4	26600	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
15	3	5	27200	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
16	3	6	27800	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
17	3	7	28400	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
18	3	8	29000	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
19	3	9	29500	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
20	3	10	30000	2025-07-10 15:05:41.454	2025-07-10 15:05:41.454
21	4	1	25000	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
22	4	2	25500	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
23	4	3	26000	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
24	4	4	26600	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
25	4	5	27200	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
26	4	6	27800	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
27	4	7	28400	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
28	4	8	29000	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
29	4	9	29500	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
30	4	10	30000	2025-09-14 03:13:04.974	2025-09-14 03:13:04.974
41	5	1	43000	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
42	5	2	43700	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
43	5	3	44400	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
44	5	4	45200	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
45	5	5	46000	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
46	5	6	46800	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
47	5	7	47600	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
48	5	8	48500	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
49	5	9	49300	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
50	5	10	50000	2025-09-26 05:15:48.947	2025-09-26 05:15:48.947
\.


--
-- Data for Name: Contribution; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Contribution" (id, amount, month, "paidDate", "memberId", "chitFundId", balance, "balancePaymentDate", "balancePaymentStatus", "actualBalancePaymentDate", notes, collected_by_id, entered_by_id, "createdById", "createdAt", "updatedAt", "transactionId") FROM stdin;
17	5000	1	2025-07-07 00:00:00	5	2	0	\N	\N	\N	\N	2	2	1	2025-07-11 14:50:43.15	2025-07-11 14:50:43.15	94
18	5000	1	2025-07-05 00:00:00	7	2	0	\N	\N	\N	\N	2	2	1	2025-07-11 14:51:12.877	2025-07-11 14:51:12.877	95
19	5000	1	2025-07-11 00:00:00	2	2	0	\N	\N	\N	\N	1	1	1	2025-07-11 14:51:42.267	2025-07-11 14:51:42.267	96
20	5000	1	2025-07-11 00:00:00	3	2	0	\N	\N	\N	\N	1	1	1	2025-07-11 14:52:04.823	2025-07-11 14:52:04.823	97
21	5000	1	2025-07-11 00:00:00	4	2	0	\N	\N	\N	\N	1	1	1	2025-07-11 14:52:29.265	2025-07-11 14:52:29.265	98
22	5000	1	2025-07-11 00:00:00	6	2	0	\N	\N	\N	\N	1	1	1	2025-07-11 14:52:49.856	2025-07-11 14:52:49.856	99
23	5000	1	2025-07-11 00:00:00	8	2	0	\N	\N	\N	\N	1	1	1	2025-07-11 14:53:11.308	2025-07-11 14:53:11.308	100
24	3000	1	2025-07-11 00:00:00	13	3	0	\N	\N	\N	\N	1	1	1	2025-07-11 15:26:29.409	2025-07-11 15:26:29.409	105
25	3000	1	2025-07-11 00:00:00	14	3	0	\N	\N	\N	\N	1	1	1	2025-07-11 15:26:52.737	2025-07-11 15:26:52.737	106
26	3000	1	2025-07-11 00:00:00	15	3	0	\N	\N	\N	\N	1	1	1	2025-07-11 15:27:16.574	2025-07-11 15:27:16.574	107
27	5000	1	2025-07-12 00:00:00	1	2	0	\N	\N	\N	\N	2	2	1	2025-07-13 14:29:29.091	2025-07-13 14:29:29.091	110
28	5000	1	2025-07-12 00:00:00	10	2	0	\N	\N	\N	\N	1	1	1	2025-07-13 14:30:08.236	2025-07-13 14:30:08.236	111
29	5000	1	2025-07-15 00:00:00	16	2	0	\N	\N	\N	\N	2	2	1	2025-07-15 16:02:58.2	2025-07-15 16:02:58.2	120
30	5000	1	2025-07-15 00:00:00	9	2	0	\N	\N	\N	\N	1	1	1	2025-07-16 04:59:12.383	2025-07-16 04:59:12.383	121
31	4800	2	2025-08-06 00:00:00	9	2	0	\N	\N	\N	\N	2	2	1	2025-08-08 08:01:09.76	2025-08-08 08:01:09.76	140
32	4800	2	2025-08-07 00:00:00	1	2	0	\N	\N	\N	\N	2	2	1	2025-08-09 13:57:14.16	2025-08-09 13:57:14.16	141
33	4800	2	2025-08-01 00:00:00	7	2	0	\N	\N	\N	\N	2	2	1	2025-08-09 13:57:45.233	2025-08-09 13:57:45.233	142
34	4800	2	2025-08-11 00:00:00	2	2	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:52:46.396	2025-08-11 23:52:46.396	144
35	4800	2	2025-08-11 00:00:00	3	2	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:53:04.483	2025-08-11 23:53:04.483	145
36	4800	2	2025-08-11 00:00:00	4	2	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:53:17.835	2025-08-11 23:53:17.835	146
37	4800	2	2025-08-11 00:00:00	6	2	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:53:34.873	2025-08-11 23:53:34.873	147
38	4800	2	2025-08-11 00:00:00	8	2	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:53:56.811	2025-08-11 23:53:56.811	148
39	2850	2	2025-08-11 00:00:00	13	3	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:55:34.431	2025-08-11 23:55:34.431	149
40	2850	2	2025-08-11 00:00:00	14	3	0	\N	\N	\N	\N	1	1	1	2025-08-11 23:55:44.153	2025-08-11 23:55:44.153	150
41	2850	2	2025-08-12 00:00:00	15	3	0	\N	\N	\N	\N	1	1	1	2025-08-12 05:44:54.807	2025-08-12 05:44:54.807	151
42	4800	2	2025-08-12 00:00:00	5	2	0	\N	\N	\N	\N	2	2	1	2025-08-12 05:47:23.991	2025-08-12 05:47:23.991	152
43	4800	2	2025-08-13 00:00:00	16	2	0	\N	\N	\N	\N	2	2	1	2025-08-13 03:46:38.091	2025-08-13 03:46:38.091	153
44	4800	2	2025-08-13 00:00:00	10	2	0	\N	\N	\N	\N	1	1	1	2025-08-13 05:25:47.496	2025-08-13 05:25:47.496	154
45	4800	3	2025-09-04 00:00:00	7	2	0	\N	\N	\N	\N	2	2	1	2025-09-05 13:26:33.661	2025-09-05 13:26:33.661	169
46	4800	3	2025-09-09 00:00:00	9	2	0	\N	\N	\N	\N	1	1	1	2025-09-09 13:52:11.189	2025-09-09 13:52:11.189	170
48	4800	3	2025-09-08 00:00:00	1	2	0	\N	\N	\N	\N	2	2	1	2025-09-10 02:04:27.804	2025-09-10 02:04:27.804	172
49	4800	3	2025-09-10 00:00:00	2	2	0	\N	\N	\N	\N	1	1	1	2025-09-10 02:44:26.76	2025-09-10 02:44:26.76	173
50	4800	3	2025-09-10 00:00:00	3	2	0	\N	\N	\N	\N	1	1	1	2025-09-10 02:44:43.273	2025-09-10 02:44:43.273	174
51	4800	3	2025-09-10 00:00:00	4	2	0	\N	\N	\N	\N	1	1	1	2025-09-10 02:44:55.882	2025-09-10 02:44:55.882	175
52	4800	3	2025-09-10 00:00:00	6	2	0	\N	\N	\N	\N	1	1	1	2025-09-10 02:45:11.247	2025-09-10 02:45:11.247	176
53	4800	3	2025-09-10 00:00:00	8	2	0	\N	\N	\N	\N	1	1	1	2025-09-10 02:45:29.015	2025-09-10 02:45:29.015	177
54	2850	3	2025-09-10 00:00:00	13	3	0	\N	\N	\N	\N	1	1	1	2025-09-10 02:47:00.718	2025-09-10 02:47:00.718	178
55	2850	3	2025-09-10 00:00:00	15	3	0	\N	\N	\N	\N	1	1	1	2025-09-10 08:52:16.759	2025-09-10 08:52:16.759	179
56	2850	3	2025-09-10 00:00:00	14	3	0	\N	\N	\N	\N	1	1	1	2025-09-10 08:52:30.471	2025-09-10 08:52:30.471	180
57	4800	3	2025-09-11 00:00:00	5	2	0	\N	\N	\N	\N	2	2	1	2025-09-11 07:11:03.934	2025-09-11 07:11:03.934	184
58	4800	3	2025-09-12 00:00:00	10	2	0	\N	\N	\N	\N	1	1	1	2025-09-13 05:24:34.44	2025-09-13 05:24:34.44	185
59	3000	1	2025-09-12 00:00:00	17	4	0	\N	\N	\N	1st month for sarath 3000	1	1	1	2025-09-14 03:14:20.827	2025-09-14 03:14:20.827	189
60	4800	3	2025-09-16 00:00:00	16	2	0	\N	\N	\N	\N	2	2	1	2025-09-16 06:51:17.752	2025-09-16 06:51:17.752	192
61	5000	1	2025-09-19 00:00:00	18	5	0	\N	\N	\N	\N	1	1	1	2025-09-26 05:18:27.701	2025-09-26 05:18:27.701	199
\.


--
-- Data for Name: EmailLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."EmailLog" (id, "emailType", period, "sentDate", status, recipients, "fileName", "isRecovery", "errorMessage", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: GlobalMember; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."GlobalMember" (id, name, contact, email, address, notes, "createdAt", "updatedAt", "createdById") FROM stdin;
1	Arunkumar	9677408773	\N	\N	\N	2025-07-04 06:53:12.182	2025-07-04 06:53:12.182	1
2	Arunpandi	8098144791	\N	\N	\N	2025-07-04 06:53:45.546	2025-07-04 06:53:45.546	1
3	Bhuvanesh	9843084885	\N	\N	\N	2025-07-04 06:54:06.739	2025-07-04 06:54:06.739	1
4	Kaviyarasu	9944877933	\N	\N	\N	2025-07-04 06:54:25.33	2025-07-04 06:54:25.33	1
5	Mano	9600968997	\N	\N	\N	2025-07-04 06:54:43.832	2025-07-04 06:54:43.832	1
6	Sarath	8122103911	\N	\N	\N	2025-07-04 06:55:01.707	2025-07-04 08:02:29.546	1
7	Manikandan	8122745979	\N	\N	\N	2025-07-10 14:38:22.624	2025-07-10 14:38:22.624	1
8	Prem	8524051550	\N	\N	\N	2025-07-10 14:39:22.61	2025-07-10 14:39:22.61	1
9	Rajaram	9976160176	\N	\N	\N	2025-07-10 14:40:26.891	2025-07-10 14:40:26.891	1
10	Chandrasekar	9750267762	\N	\N	\N	2025-07-10 14:40:53.29	2025-07-10 14:40:53.29	1
11	Suryaprakash	8754131287	\N	\N	\N	2025-07-10 14:41:09.67	2025-07-10 14:41:09.67	1
12	Saraswathi	8675119600	\N	\N	\N	2025-07-10 14:41:52.88	2025-07-10 14:41:52.88	1
13	Santhosh	9952664136	\N	\N	\N	2025-07-10 14:43:45.428	2025-07-10 14:43:45.428	1
14	Latha	9600968997	\N	\N	\N	2025-07-10 14:47:43.88	2025-07-10 14:47:43.88	1
15	Kaviya	9715994651	\N	\N	\N	2025-07-10 14:47:59.937	2025-07-10 14:47:59.937	1
16	Dhurga	8754131287	\N	\N	\N	2025-07-10 14:48:17.213	2025-07-10 14:48:17.213	1
17	Sudha Paramesh	8220776884	\N	\N	\N	2025-07-10 15:01:42.028	2025-07-10 15:01:42.028	1
19	THANGAPANDI	8148105630	thangapandivvg395@gmail.com	\N	\N	2025-07-10 15:20:40.451	2025-07-10 15:20:40.451	1
20	Abiraman	8489371891	\N	\N	\N	2025-09-26 05:17:09.78	2025-09-26 05:17:09.78	1
\.


--
-- Data for Name: Loan; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Loan" (id, "borrowerId", "loanType", amount, "interestRate", "documentCharge", "currentMonth", "installmentAmount", duration, "disbursementDate", "repaymentType", "remainingAmount", "overdueAmount", "missedPayments", "nextPaymentDate", status, purpose, "createdAt", "updatedAt", "createdById", disbursed_by_id, entered_by_id, "transactionId") FROM stdin;
3	1	Monthly	25000	500	1500	9	5500	9	2024-11-11 00:00:00	Monthly	0	0	0	\N	Completed	personal	2025-07-04 07:01:42.927	2025-09-25 04:29:15.84	1	2	2	3
4	1	Weekly	15000	0	0	17	1000	17	2025-03-31 00:00:00	Weekly	0	0	0	\N	Completed	personal	2025-07-04 07:25:25.559	2025-08-30 02:19:16.686	1	2	2	19
11	2	Weekly	5000	0	0	11	500	11	2025-04-24 00:00:00	Weekly	0	0	0	\N	Completed	Personal Loan 	2025-07-07 08:31:48.737	2025-08-30 02:23:35.859	1	2	2	53
12	1	Weekly	20000	0	0	6	1000	22	2025-07-31 00:00:00	Weekly	13333.33333333333	1000	1	2025-09-25 00:00:00	Active	31-jul- 10000 given and 04-Aug remaining 10000 given	2025-08-04 13:38:16.199	2025-09-28 17:11:17.973	1	2	2	133
2	4	Monthly	20000	600	0	12	2600	15	2024-09-16 00:00:00	Monthly	20000	18200	7	2025-03-16 00:00:00	Active	personal	2025-07-04 07:00:31.386	2025-09-30 07:04:53.603	1	2	2	2
9	5	Monthly	40000	800	0	5	2800	20	2025-04-15 00:00:00	Monthly	30000	0	0	2025-10-15 00:00:00	Active	2l loan repayment	2025-07-04 07:59:32.353	2025-09-13 05:25:31.675	1	1	1	48
5	3	Monthly	26000	500	1000	6	4850	6	2025-01-12 00:00:00	Monthly	0	0	0	\N	Completed	personal	2025-07-04 07:45:55.174	2025-07-31 10:17:48.097	1	2	2	31
10	6	Monthly	20000	400	1000	5	3730	6	2025-05-06 00:00:00	Monthly	6666.666666666668	0	0	2025-10-06 00:00:00	Active	personal	2025-07-04 08:01:30.798	2025-09-10 14:08:52.149	1	1	1	51
8	6	Monthly	15000	300	500	8	2170	9	2025-01-11 00:00:00	Monthly	1666.666666666668	0	0	2025-10-11 00:00:00	Active	personal	2025-07-04 07:56:51.256	2025-09-10 14:09:23.158	1	1	1	43
1	1	Monthly	10000	200	0	5	2200	5	2025-03-01 00:00:00	Monthly	0	0	0	\N	Completed	personal	2025-07-04 06:57:33.134	2025-08-07 03:20:37.683	1	2	2	1
\.


--
-- Data for Name: Member; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Member" (id, "globalMemberId", "chitFundId", "joinDate", "auctionWon", "auctionMonth", contribution, "createdAt", "updatedAt") FROM stdin;
1	1	2	2025-07-10 15:00:17.868	f	\N	4800	2025-07-10 15:00:17.869	2025-07-10 15:00:17.869
2	16	2	2025-07-10 15:00:20.659	f	\N	4800	2025-07-10 15:00:20.66	2025-07-10 15:00:20.66
3	15	2	2025-07-10 15:00:22.726	f	\N	4800	2025-07-10 15:00:22.727	2025-07-10 15:00:22.727
4	14	2	2025-07-10 15:00:24.933	f	\N	4800	2025-07-10 15:00:24.934	2025-07-10 15:00:24.934
5	7	2	2025-07-10 15:00:27.289	f	\N	4800	2025-07-10 15:00:27.29	2025-07-10 15:00:27.29
6	5	2	2025-07-10 15:00:29.645	f	\N	4800	2025-07-10 15:00:29.647	2025-07-10 15:00:29.647
7	13	2	2025-07-10 15:00:32.111	f	\N	4800	2025-07-10 15:00:32.113	2025-07-10 15:00:32.113
8	11	2	2025-07-10 15:00:34.56	f	\N	4800	2025-07-10 15:00:34.561	2025-07-10 15:00:34.561
9	9	2	2025-07-10 15:00:37.628	f	\N	4800	2025-07-10 15:00:37.629	2025-07-10 15:00:37.629
10	17	2	2025-07-10 15:02:18.857	f	\N	4800	2025-07-10 15:02:18.858	2025-07-10 15:02:18.858
13	12	3	2025-07-10 15:23:40.472	f	\N	2850	2025-07-10 15:23:40.473	2025-07-10 15:23:40.473
14	8	3	2025-07-10 15:23:42.857	f	\N	2850	2025-07-10 15:23:42.858	2025-07-10 15:23:42.858
15	10	3	2025-07-10 15:25:05.437	f	\N	2850	2025-07-10 15:25:05.438	2025-07-10 15:25:05.438
16	19	2	2025-07-15 16:02:09.436	f	\N	4800	2025-07-15 16:02:09.437	2025-07-15 16:02:09.437
17	6	4	2025-09-14 03:13:38.942	f	\N	2850	2025-09-14 03:13:38.944	2025-09-14 03:13:38.944
18	20	5	2025-09-26 05:17:34.841	f	\N	4800	2025-09-26 05:17:34.842	2025-09-26 05:17:34.842
\.


--
-- Data for Name: Partner; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Partner" (id, name, code, "isActive", "createdAt", "updatedAt", "createdById") FROM stdin;
1	Mano	ADMIN	t	2025-07-04 06:21:28.009	2025-07-04 06:21:28.009	1
2	Arul	PARTNER	t	2025-07-04 06:21:28.015	2025-07-04 06:21:28.015	1
\.


--
-- Data for Name: PaymentSchedule; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."PaymentSchedule" (id, "loanId", period, "dueDate", amount, status, "actualPaymentDate", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Repayment; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Repayment" (id, amount, "paidDate", period, "loanId", "createdAt", "updatedAt", "paymentType", collected_by_id, "createdById", entered_by_id, "transactionId") FROM stdin;
1	2200	2025-04-01 00:00:00	1	1	2025-07-04 07:03:01.042	2025-07-04 07:03:01.042	REGULAR	2	1	2	4
2	2200	2025-05-01 00:00:00	2	1	2025-07-04 07:03:21.152	2025-07-04 07:03:21.152	REGULAR	2	1	2	5
3	2200	2025-06-06 00:00:00	3	1	2025-07-04 07:03:47.377	2025-07-04 07:03:47.377	REGULAR	2	1	2	6
5	600	2024-10-16 00:00:00	1	2	2025-07-04 07:12:27.421	2025-07-04 07:12:27.421	INTEREST_ONLY	2	1	2	8
6	600	2024-11-16 00:00:00	2	2	2025-07-04 07:12:52.405	2025-07-04 07:12:52.405	INTEREST_ONLY	2	1	2	9
7	600	2025-04-12 00:00:00	3	2	2025-07-04 07:13:19.48	2025-07-04 07:13:19.48	INTEREST_ONLY	2	1	2	10
8	600	2025-04-12 00:00:00	4	2	2025-07-04 07:13:41.791	2025-07-04 07:13:41.791	INTEREST_ONLY	2	1	2	11
9	600	2025-05-15 00:00:00	5	2	2025-07-04 07:14:11.485	2025-07-04 07:14:11.485	INTEREST_ONLY	2	1	2	12
10	5500	2025-01-10 00:00:00	1	3	2025-07-04 07:14:59.062	2025-07-04 07:14:59.062	REGULAR	2	1	2	13
11	5500	2025-02-10 00:00:00	2	3	2025-07-04 07:15:17.218	2025-07-04 07:15:17.218	REGULAR	2	1	2	14
12	500	2025-03-10 00:00:00	3	3	2025-07-04 07:15:54.201	2025-07-04 07:15:54.201	INTEREST_ONLY	2	1	2	15
13	5500	2025-04-14 00:00:00	4	3	2025-07-04 07:23:00.767	2025-07-04 07:23:00.767	REGULAR	2	1	2	16
14	500	2025-05-11 00:00:00	5	3	2025-07-04 07:23:23.822	2025-07-04 07:23:23.822	INTEREST_ONLY	2	1	2	17
15	500	2025-06-09 00:00:00	6	3	2025-07-04 07:23:45.66	2025-07-04 07:23:45.66	INTEREST_ONLY	2	1	2	18
16	1000	2025-04-07 00:00:00	1	4	2025-07-04 07:31:43.276	2025-07-04 07:31:43.276	REGULAR	2	1	2	20
17	1000	2025-04-14 00:00:00	2	4	2025-07-04 07:32:14.953	2025-07-04 07:32:14.953	REGULAR	2	1	2	21
18	1000	2025-04-21 00:00:00	3	4	2025-07-04 07:32:34.54	2025-07-04 07:32:34.54	REGULAR	2	1	2	22
19	1000	2025-04-28 00:00:00	4	4	2025-07-04 07:32:51.467	2025-07-04 07:32:51.467	REGULAR	2	1	2	23
20	1000	2025-05-06 00:00:00	5	4	2025-07-04 07:33:11.008	2025-07-04 07:33:11.008	REGULAR	2	1	2	24
21	1000	2025-05-13 00:00:00	6	4	2025-07-04 07:33:27.478	2025-07-04 07:33:27.478	REGULAR	2	1	2	25
22	1000	2025-05-19 00:00:00	7	4	2025-07-04 07:33:57.053	2025-07-04 07:33:57.053	REGULAR	2	1	2	26
23	1000	2025-05-27 00:00:00	8	4	2025-07-04 07:34:13.096	2025-07-04 07:34:13.096	REGULAR	2	1	2	27
24	1000	2025-06-09 00:00:00	9	4	2025-07-04 07:35:07.185	2025-07-04 07:35:07.185	REGULAR	2	1	2	28
25	1000	2025-06-09 00:00:00	10	4	2025-07-04 07:35:43.361	2025-07-04 07:35:43.361	REGULAR	2	1	2	29
26	1000	2025-06-19 00:00:00	11	4	2025-07-04 07:36:07.692	2025-07-04 07:36:07.692	REGULAR	2	1	2	30
27	4850	2025-02-12 00:00:00	1	5	2025-07-04 07:46:21.997	2025-07-04 07:46:21.997	REGULAR	2	1	2	32
28	4850	2025-03-12 00:00:00	2	5	2025-07-04 07:46:41.695	2025-07-04 07:46:41.695	REGULAR	2	1	2	33
29	4850	2025-04-12 00:00:00	3	5	2025-07-04 07:47:03.47	2025-07-04 07:47:03.47	REGULAR	2	1	2	34
30	4850	2025-05-12 00:00:00	4	5	2025-07-04 07:47:41.335	2025-07-04 07:47:41.335	REGULAR	2	1	2	35
31	4850	2025-06-12 00:00:00	5	5	2025-07-04 07:48:00.277	2025-07-04 07:48:00.277	REGULAR	2	1	2	36
36	2170	2025-02-11 00:00:00	1	8	2025-07-04 07:57:26.596	2025-07-04 07:57:26.596	REGULAR	1	1	1	44
37	2170	2025-03-11 00:00:00	2	8	2025-07-04 07:57:45.624	2025-07-04 07:57:45.624	REGULAR	1	1	1	45
38	2170	2025-04-05 00:00:00	3	8	2025-07-04 07:58:16.903	2025-07-04 07:58:16.903	REGULAR	1	1	1	46
40	2800	2025-05-15 00:00:00	1	9	2025-07-04 07:59:57.99	2025-07-04 07:59:57.99	REGULAR	1	1	1	49
41	2800	2025-06-15 00:00:00	2	9	2025-07-04 08:00:16.996	2025-07-04 08:00:16.996	REGULAR	1	1	1	50
42	3730	2025-06-12 00:00:00	1	10	2025-07-04 08:02:51.641	2025-07-04 08:02:51.641	REGULAR	1	1	1	52
44	500	2025-07-07 00:00:00	1	11	2025-07-07 08:33:02.762	2025-07-07 08:33:02.762	REGULAR	2	1	2	55
45	500	2025-07-07 00:00:00	2	11	2025-07-07 08:33:25.858	2025-07-07 08:33:25.858	REGULAR	2	1	2	56
46	500	2025-07-07 00:00:00	3	11	2025-07-07 08:34:34.592	2025-07-07 08:34:34.592	REGULAR	2	1	2	57
47	500	2025-06-07 00:00:00	7	11	2025-07-07 08:36:30.23	2025-07-07 08:36:30.23	REGULAR	2	1	2	58
48	500	2025-06-07 00:00:00	6	11	2025-07-07 08:37:20.147	2025-07-07 08:37:20.147	REGULAR	2	1	2	59
50	500	2025-06-07 00:00:00	8	11	2025-07-07 08:38:35.15	2025-07-07 08:38:35.15	REGULAR	2	1	2	61
51	500	2025-06-07 00:00:00	4	11	2025-07-07 08:39:12.046	2025-07-07 08:39:12.046	REGULAR	2	1	2	62
52	500	2025-06-07 00:00:00	5	11	2025-07-07 08:39:41.929	2025-07-07 08:39:41.929	REGULAR	2	1	2	63
53	500	2025-07-07 00:00:00	9	11	2025-07-07 08:42:10.757	2025-07-07 08:42:10.757	REGULAR	2	1	2	64
54	500	2025-07-07 00:00:00	10	11	2025-07-07 08:44:06.508	2025-07-07 08:44:06.508	REGULAR	2	1	2	65
56	1000	2025-06-24 00:00:00	12	4	2025-07-11 07:04:16.306	2025-07-11 07:04:16.306	REGULAR	2	1	2	76
59	4850	2025-07-10 00:00:00	6	5	2025-07-11 14:48:00.467	2025-07-11 14:48:00.467	REGULAR	2	1	2	93
61	300	2025-07-11 00:00:00	4	8	2025-07-11 15:08:56.718	2025-07-11 15:08:56.718	INTEREST_ONLY	1	1	1	102
62	2170	2025-06-11 00:00:00	5	8	2025-07-11 15:12:00.931	2025-07-11 15:12:00.931	REGULAR	1	1	1	103
63	2170	2025-07-11 15:12:13.515	6	8	2025-07-11 15:12:14.464	2025-07-11 15:12:14.464	REGULAR	1	1	1	104
64	5500	2025-07-12 00:00:00	7	3	2025-07-13 14:31:31.102	2025-07-13 14:31:31.102	REGULAR	2	1	2	112
65	3730	2025-07-13 00:00:00	2	10	2025-07-13 14:36:18.849	2025-07-13 14:36:18.849	REGULAR	1	1	1	113
66	1000	2025-07-13 00:00:00	13	4	2025-07-14 02:56:48.248	2025-07-14 02:56:48.248	REGULAR	2	1	2	116
67	1000	2025-07-13 00:00:00	14	4	2025-07-14 02:57:12.668	2025-07-14 02:57:12.668	REGULAR	2	1	2	117
68	2200	2025-07-13 00:00:00	4	1	2025-07-14 02:58:13.217	2025-07-14 02:58:13.217	REGULAR	2	1	2	118
69	2800	2025-07-15 15:59:39.874	3	9	2025-07-15 15:59:40.51	2025-07-15 15:59:40.51	REGULAR	1	1	1	119
71	1000	2025-07-14 00:00:00	15	4	2025-07-31 10:29:46.531	2025-07-31 10:29:46.531	REGULAR	2	1	2	127
72	1000	2025-07-07 00:00:00	16	4	2025-07-31 10:31:03.49	2025-07-31 10:31:03.49	REGULAR	2	1	2	128
73	1000	2025-07-28 00:00:00	17	4	2025-07-31 10:32:18.916	2025-07-31 10:32:18.916	REGULAR	2	1	2	129
74	500	2025-07-10 00:00:00	11	11	2025-07-31 11:20:57.181	2025-07-31 11:20:57.181	REGULAR	2	1	2	130
75	2200	2025-08-06 00:00:00	5	1	2025-08-06 16:39:14.426	2025-08-06 16:39:14.426	REGULAR	2	1	2	136
76	1000	2025-08-09 00:00:00	1	12	2025-08-09 13:59:14.809	2025-08-09 13:59:14.809	REGULAR	2	1	2	143
77	2170	2025-08-13 06:11:43.851	7	8	2025-08-13 06:11:44.817	2025-08-13 06:11:44.817	REGULAR	1	1	1	157
78	3730	2025-08-13 00:00:00	3	10	2025-08-13 06:13:14.539	2025-08-13 06:13:14.539	REGULAR	1	1	1	158
79	2800	2025-08-13 06:21:20.63	4	9	2025-08-13 06:21:21.699	2025-08-13 06:21:21.699	REGULAR	1	1	1	159
80	1000	2025-08-15 00:00:00	2	12	2025-08-19 07:20:43.288	2025-08-19 07:20:43.288	REGULAR	2	1	2	162
81	1000	2025-08-21 00:00:00	3	12	2025-08-21 06:16:44.94	2025-08-21 06:16:44.94	REGULAR	2	1	2	166
82	500	2025-08-21 00:00:00	8	3	2025-08-21 06:19:37.492	2025-08-21 06:19:37.492	INTEREST_ONLY	2	1	2	167
84	3730	2025-09-10 00:00:00	4	10	2025-09-10 14:08:49.213	2025-09-10 14:08:49.213	REGULAR	1	1	1	182
85	2170	2025-09-10 14:09:15.33	8	8	2025-09-10 14:09:19.853	2025-09-10 14:09:19.853	REGULAR	1	1	1	183
83	1000	2025-08-30 00:00:00	4	12	2025-09-05 13:23:44.704	2025-09-05 13:23:44.704	REGULAR	2	1	2	168
86	2800	2025-09-13 05:25:27.726	5	9	2025-09-13 05:25:28.691	2025-09-13 05:25:28.691	REGULAR	1	1	1	186
87	1000	2025-09-12 00:00:00	5	12	2025-09-14 05:14:09.293	2025-09-14 05:14:09.293	REGULAR	2	1	2	190
88	1000	2025-09-12 00:00:00	6	12	2025-09-14 05:15:17.722	2025-09-14 05:15:17.722	REGULAR	2	1	2	191
89	5500	2025-09-19 00:00:00	9	3	2025-09-25 04:29:12.613	2025-09-25 04:29:12.613	REGULAR	2	1	2	196
90	1000	2025-09-28 00:00:00	7	12	2025-09-28 17:11:15.147	2025-09-28 17:11:15.147	REGULAR	2	1	2	200
\.


--
-- Data for Name: Transaction; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Transaction" (id, type, amount, from_partner, to_partner, action_performer, entered_by, date, note, "createdAt", "updatedAt", "createdById", from_partner_id, to_partner_id, "partnerBalance", "totalBalance") FROM stdin;
6	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-06-06 00:00:00	Repayment from Arunkumar - Period 3	2025-07-04 07:03:47.377	2025-08-09 16:30:20.634	1	\N	2	-48400	-48400
11	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2025-04-12 00:00:00	Repayment from Kaviyarasu - Period 4	2025-07-04 07:13:41.791	2025-08-09 16:30:21.76	1	\N	2	-46000	-46000
15	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-03-10 00:00:00	Repayment from Arunkumar - Period 3	2025-07-04 07:15:54.201	2025-08-09 16:30:22.989	1	\N	2	-33900	-33900
45	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-03-11 00:00:00	Repayment from Sarath - Period 2	2025-07-04 07:57:45.624	2025-08-09 16:30:29.953	1	\N	1	-10660	-43810
33	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-03-12 00:00:00	Repayment from Bhuvanesh - Period 2	2025-07-04 07:46:41.695	2025-08-09 16:30:28.314	1	\N	2	-47700	-47700
16	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-04-14 00:00:00	Repayment from Arunkumar - Period 4	2025-07-04 07:23:00.767	2025-08-09 16:30:23.297	1	\N	2	-28400	-28400
46	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-04-05 00:00:00	Repayment from Sarath - Period 3	2025-07-04 07:58:16.903	2025-08-09 16:30:30.259	1	\N	1	-8490	-41640
34	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-04-12 00:00:00	Repayment from Bhuvanesh - Period 3	2025-07-04 07:47:03.47	2025-08-09 16:30:28.621	1	\N	2	-42850	-42850
5	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-05-01 00:00:00	Repayment from Arunkumar - Period 2	2025-07-04 07:03:21.152	2025-08-09 16:30:20.327	1	\N	2	-50600	-50600
17	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-05-11 00:00:00	Repayment from Arunkumar - Period 5	2025-07-04 07:23:23.822	2025-08-09 16:30:23.603	1	\N	2	-27900	-27900
48	LOAN_DISBURSEMENT	40000	\N	\N	Mano	Mano	2025-04-15 00:00:00	Loan disbursed to Mano	2025-07-04 07:59:32.353	2025-08-09 16:30:30.566	1	1	\N	-48490	-81640
35	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-05-12 00:00:00	Repayment from Bhuvanesh - Period 4	2025-07-04 07:47:41.335	2025-08-09 16:30:28.927	1	\N	2	-38000	-38000
21	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-14 00:00:00	Repayment from Arunkumar - Period 2	2025-07-04 07:32:14.953	2025-08-09 16:30:24.833	1	\N	2	-40400	-40400
49	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-05-15 00:00:00	Repayment from Mano - Period 1	2025-07-04 07:59:57.99	2025-08-09 16:30:30.874	1	\N	1	-45690	-78840
23	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-28 00:00:00	Repayment from Arunkumar - Period 4	2025-07-04 07:32:51.467	2025-08-09 16:30:25.344	1	\N	2	-38400	-38400
12	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2025-05-15 00:00:00	Repayment from Kaviyarasu - Period 5	2025-07-04 07:14:11.485	2025-08-09 16:30:22.067	1	\N	2	-45400	-45400
13	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-01-10 00:00:00	Repayment from Arunkumar - Period 1	2025-07-04 07:14:59.062	2025-08-09 16:30:22.375	1	\N	2	-39900	-39900
36	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-06-12 00:00:00	Repayment from Bhuvanesh - Period 5	2025-07-04 07:48:00.277	2025-08-09 16:30:29.153	1	\N	2	-33150	-33150
18	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-09 00:00:00	Repayment from Arunkumar - Period 6	2025-07-04 07:23:45.66	2025-08-09 16:30:23.911	1	\N	2	-27400	-27400
24	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-06 00:00:00	Repayment from Arunkumar - Period 5	2025-07-04 07:33:11.008	2025-08-09 16:30:25.652	1	\N	2	-37400	-37400
50	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-06-15 00:00:00	Repayment from Mano - Period 2	2025-07-04 08:00:16.996	2025-08-09 16:30:31.182	1	\N	1	-42890	-76040
56	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 2	2025-07-07 08:33:25.858	2025-08-09 16:30:32.842	1	\N	2	-37150	-96310
26	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-19 00:00:00	Repayment from Arunkumar - Period 7	2025-07-04 07:33:57.053	2025-08-09 16:30:26.265	1	\N	2	-35400	-35400
8	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2024-10-16 00:00:00	Repayment from Kaviyarasu - Period 1	2025-07-04 07:12:27.421	2025-08-09 16:30:20.944	1	\N	2	-47800	-47800
27	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-27 00:00:00	Repayment from Arunkumar - Period 8	2025-07-04 07:34:13.096	2025-08-09 16:30:26.575	1	\N	2	-34400	-34400
53	LOAN_DISBURSEMENT	5000	\N	\N	Arul	Arul	2025-04-24 00:00:00	Loan disbursed to Arunpandi	2025-07-07 08:31:48.737	2025-08-09 16:30:32.308	1	2	\N	-38150	-97310
19	LOAN_DISBURSEMENT	15000	\N	\N	Arul	Arul	2025-03-31 00:00:00	Loan disbursed to Arunkumar	2025-07-04 07:25:25.559	2025-08-09 16:30:24.218	1	2	\N	-42400	-42400
43	LOAN_DISBURSEMENT	15000	\N	\N	Mano	Mano	2025-01-11 00:00:00	Loan disbursed to Sarath	2025-07-04 07:56:51.256	2025-08-09 16:30:29.391	1	1	\N	-15000	-48150
14	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-02-10 00:00:00	Repayment from Arunkumar - Period 2	2025-07-04 07:15:17.218	2025-08-09 16:30:22.682	1	\N	2	-34400	-34400
51	LOAN_DISBURSEMENT	20000	\N	\N	Mano	Mano	2025-05-06 00:00:00	Loan disbursed to Sarath	2025-07-04 08:01:30.798	2025-08-09 16:30:31.407	1	1	\N	-62890	-96040
29	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-09 00:00:00	Repayment from Arunkumar - Period 10	2025-07-04 07:35:43.361	2025-08-09 16:30:27.187	1	\N	2	-32400	-32400
30	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-19 00:00:00	Repayment from Arunkumar - Period 11	2025-07-04 07:36:07.692	2025-08-09 16:30:27.413	1	\N	2	-31400	-31400
9	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2024-11-16 00:00:00	Repayment from Kaviyarasu - Period 2	2025-07-04 07:12:52.405	2025-08-09 16:30:21.247	1	\N	2	-47200	-47200
127	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-14 00:00:00	Repayment from Arunkumar - Period 15	2025-07-31 10:29:46.531	2025-08-09 16:30:46.357	1	\N	2	17760	48234
20	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-07 00:00:00	Repayment from Arunkumar - Period 1	2025-07-04 07:31:43.276	2025-08-09 16:30:24.526	1	\N	2	-41400	-41400
31	LOAN_DISBURSEMENT	26000	\N	\N	Arul	Arul	2025-01-12 00:00:00	Loan disbursed to Bhuvanesh	2025-07-04 07:45:55.174	2025-08-09 16:30:27.699	1	2	\N	-57400	-57400
44	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-02-11 00:00:00	Repayment from Sarath - Period 1	2025-07-04 07:57:26.596	2025-08-09 16:30:29.645	1	\N	1	-12830	-45980
55	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 1	2025-07-07 08:33:02.762	2025-08-09 16:30:32.617	1	\N	2	-37650	-96810
52	LOAN_REPAYMENT	3730	\N	\N	Mano	Mano	2025-06-12 00:00:00	Repayment from Sarath - Period 1	2025-07-04 08:02:51.641	2025-08-09 16:30:31.692	1	\N	1	-59160	-92310
32	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-02-12 00:00:00	Repayment from Bhuvanesh - Period 1	2025-07-04 07:46:21.997	2025-08-09 16:30:28.006	1	\N	2	-52550	-52550
58	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 7	2025-07-07 08:36:30.23	2025-08-09 16:30:33.352	1	\N	2	-36150	-95310
59	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 6	2025-07-07 08:37:20.147	2025-08-09 16:30:33.639	1	\N	2	-35650	-94810
1	LOAN_DISBURSEMENT	10000	\N	\N	Arul	Arul	2025-03-01 00:00:00	Loan disbursed to Arunkumar	2025-07-04 06:57:33.134	2025-08-09 16:30:18.899	1	2	\N	-10000	-10000
3	LOAN_DISBURSEMENT	25000	\N	\N	Arul	Arul	2024-11-11 00:00:00	Loan disbursed to Arunkumar	2025-07-04 07:01:42.927	2025-08-09 16:30:19.712	1	2	\N	-55000	-55000
10	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2025-04-12 00:00:00	Repayment from Kaviyarasu - Period 3	2025-07-04 07:13:19.48	2025-08-09 16:30:21.472	1	\N	2	-46600	-46600
138	PARTNER_TO_PARTNER	13000	Mano	\N	Arul	Arul	2025-08-07 00:00:00	Transfer to Arul - for Raja 50k chit	2025-08-07 03:23:50.534	2025-08-09 16:30:49.92	1	1	\N	974	-10066
139	PARTNER_TO_PARTNER	13000	\N	Arul	Arul	Arul	2025-08-07 00:00:00	Transfer from Mano - for Raja 50k chit	2025-08-07 03:23:50.7	2025-08-09 16:30:50.227	1	\N	2	-11040	-10066
142	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-08-01 00:00:00	Chit contribution from Santhosh - 50k chit fund-07-25 Month 2	2025-08-09 13:57:45.233	2025-08-09 16:30:51.149	1	\N	2	3360	4334
147	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Mano - 50k chit fund-07-25 Month 2	2025-08-11 23:53:34.873	2025-08-11 23:53:34.873	1	\N	1	20174	24534
148	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Suryaprakash - 50k chit fund-07-25 Month 2	2025-08-11 23:53:56.811	2025-08-11 23:53:56.811	1	\N	1	24974	29334
152	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-08-12 00:00:00	Chit contribution from Manikandan - 50k chit fund-07-25 Month 2	2025-08-12 05:47:23.991	2025-08-12 05:47:23.991	1	\N	2	9160	42684
157	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-08-13 06:11:43.851	Repayment from Sarath - Period 7	2025-08-13 06:11:44.817	2025-08-13 06:11:44.817	1	\N	1	25494	54454
158	LOAN_REPAYMENT	3730	\N	\N	Mano	Mano	2025-08-13 00:00:00	Repayment from Sarath - Period 3	2025-08-13 06:13:14.539	2025-08-13 06:13:14.539	1	\N	1	29224	58184
162	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-08-15 00:00:00	Repayment from Arunkumar - Period 2	2025-08-19 07:20:43.288	2025-08-19 07:20:43.288	1	\N	2	-13740	-7216
169	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-09-04 00:00:00	Chit contribution from Santhosh - 50k chit fund-07-25 Month 3	2025-09-05 13:26:33.661	2025-09-05 13:26:33.661	1	\N	2	7300	9684
172	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-09-08 00:00:00	Chit contribution from Arunkumar - 50k chit fund-07-25 Month 3	2025-09-10 02:04:27.804	2025-09-10 02:04:27.804	1	\N	2	12100	19284
174	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Kaviya - 50k chit fund-07-25 Month 3	2025-09-10 02:44:43.273	2025-09-10 02:44:43.273	1	\N	1	16784	28884
180	CHIT_CONTRIBUTION	2850	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Prem - 30k chit fund-07-25 Month 3	2025-09-10 08:52:30.471	2025-09-10 08:52:30.471	1	\N	1	39734	51834
195	AUCTION_PAYOUT	44400	\N	\N	Arul	Arul	2025-09-17 00:00:00	Auction payout to Manikandan - 50k chit fund-07-25 Month 3	2025-09-17 05:47:10.516	2025-09-17 05:47:10.516	1	2	\N	2300	9534
199	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-09-19 00:00:00	Chit contribution from Abiraman - 50k chit fund-09-25 Month 1	2025-09-26 05:18:27.701	2025-09-26 05:18:27.701	1	\N	1	11834	18834
200	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-09-28 00:00:00	Repayment from Arunkumar - Period 7	2025-09-28 17:11:15.147	2025-09-28 17:11:15.147	1	\N	2	8000	19834
4	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-04-01 00:00:00	Repayment from Arunkumar - Period 1	2025-07-04 07:03:01.042	2025-08-09 16:30:20.02	1	\N	2	-52800	-52800
22	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-21 00:00:00	Repayment from Arunkumar - Period 3	2025-07-04 07:32:34.54	2025-08-09 16:30:25.057	1	\N	2	-39400	-39400
25	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-13 00:00:00	Repayment from Arunkumar - Period 6	2025-07-04 07:33:27.478	2025-08-09 16:30:25.958	1	\N	2	-36400	-36400
28	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-09 00:00:00	Repayment from Arunkumar - Period 9	2025-07-04 07:35:07.185	2025-08-09 16:30:26.881	1	\N	2	-33400	-33400
61	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 8	2025-07-07 08:38:35.15	2025-08-09 16:30:33.945	1	\N	2	-35150	-94310
62	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 4	2025-07-07 08:39:12.046	2025-08-09 16:30:34.254	1	\N	2	-34650	-93810
63	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 5	2025-07-07 08:39:41.929	2025-08-09 16:30:34.56	1	\N	2	-34150	-93310
64	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 9	2025-07-07 08:42:10.757	2025-08-09 16:30:34.867	1	\N	2	-33650	-92810
65	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 10	2025-07-07 08:44:06.508	2025-08-09 16:30:35.174	1	\N	2	-33150	-92310
76	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-24 00:00:00	Repayment from Arunkumar - Period 12	2025-07-11 07:04:16.306	2025-08-09 16:30:35.399	1	\N	2	-32150	-91310
79	RECORD_AMOUNT	55380	\N	Arul	Arul	Arul	2025-06-30 00:00:00	old amount reset	2025-07-11 07:24:28.558	2025-08-09 16:30:35.687	1	\N	2	23230	-35930
80	RECORD_AMOUNT	12420	\N	Arul	Arul	Arul	2025-06-30 00:00:00	old amount reset	2025-07-11 07:25:15.262	2025-08-09 16:30:35.994	1	\N	2	35650	-23510
90	RECORD_AMOUNT	9000	\N	Mano	Mano	Mano	2025-06-30 00:00:00	tally old remaining balance	2025-07-11 14:41:38.868	2025-08-09 16:30:36.916	1	\N	1	-1736	33914
94	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-07 00:00:00	Chit contribution from Manikandan - 50k chit fund-07-25 Month 1	2025-07-11 14:50:43.15	2025-08-09 16:30:37.837	1	\N	2	45500	48564
95	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-05 00:00:00	Chit contribution from Santhosh - 50k chit fund-07-25 Month 1	2025-07-11 14:51:12.877	2025-08-09 16:30:38.144	1	\N	2	50500	53564
114	RECORD_AMOUNT	4800	\N	Mano	Mano	Mano	2025-07-12 00:00:00	Sudha paramesh old 50k last due	2025-07-13 14:42:14.362	2025-08-09 16:30:42.875	1	\N	1	55234	73234
119	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-07-15 15:59:39.874	Repayment from Mano - Period 3	2025-07-15 15:59:40.51	2025-08-09 16:30:44.288	1	\N	1	15034	37234
124	PARTNER_TO_PARTNER	29440	Arul	\N	Mano	Mano	2025-06-30 00:00:00	Transfer to Mano	2025-07-19 17:02:14.18	2025-08-09 16:30:45.825	1	2	\N	16760	47234
125	PARTNER_TO_PARTNER	29440	\N	Mano	Mano	Mano	2025-06-30 00:00:00	Transfer from Arul	2025-07-19 17:02:14.818	2025-08-09 16:30:46.131	1	\N	1	30474	47234
128	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunkumar - Period 16	2025-07-31 10:31:03.49	2025-08-09 16:30:46.644	1	\N	2	18760	49234
84	RECORD_AMOUNT	4800	\N	Mano	Mano	Mano	2025-07-11 00:00:00	abi previous 50k chit last amount	2025-07-11 07:32:18.542	2025-08-09 16:30:36.608	1	\N	1	-10736	24914
120	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-15 00:00:00	Chit contribution from THANGAPANDI - 50k chit fund-07-25 Month 1	2025-07-15 16:02:58.2	2025-08-09 16:30:44.596	1	\N	2	27200	42234
121	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-15 00:00:00	Chit contribution from Rajaram - 50k chit fund-07-25 Month 1	2025-07-16 04:59:12.383	2025-08-09 16:30:44.902	1	\N	1	20034	47234
129	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-28 00:00:00	Repayment from Arunkumar - Period 17	2025-07-31 10:32:18.916	2025-08-09 16:30:46.951	1	\N	2	19760	50234
143	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-08-09 00:00:00	Repayment from Arunkumar - Period 1	2025-08-09 13:59:14.809	2025-08-09 16:30:51.373	1	\N	2	4360	5334
149	CHIT_CONTRIBUTION	2850	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Saraswathi - 30k chit fund-07-25 Month 2	2025-08-11 23:55:34.431	2025-08-11 23:55:34.431	1	\N	1	27824	32184
150	CHIT_CONTRIBUTION	2850	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Prem - 30k chit fund-07-25 Month 2	2025-08-11 23:55:44.153	2025-08-11 23:55:44.153	1	\N	1	30674	35034
178	CHIT_CONTRIBUTION	2850	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Saraswathi - 30k chit fund-07-25 Month 3	2025-09-10 02:47:00.718	2025-09-10 02:47:00.718	1	\N	1	34034	46134
91	RECORD_AMOUNT	4800	\N	Mano	Mano	Mano	2025-06-30 00:00:00	for tally old remaing balnce(alrady updated abi 50k last fnud)	2025-07-11 14:43:05.757	2025-08-09 16:30:37.223	1	\N	1	3064	38714
93	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-07-10 00:00:00	Repayment from Bhuvanesh - Period 6	2025-07-11 14:48:00.467	2025-08-09 16:30:37.53	1	\N	2	40500	43564
96	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Dhurga - 50k chit fund-07-25 Month 1	2025-07-11 14:51:42.267	2025-08-09 16:30:38.374	1	\N	1	8064	58564
97	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Kaviya - 50k chit fund-07-25 Month 1	2025-07-11 14:52:04.823	2025-08-09 16:30:38.598	1	\N	1	13064	63564
98	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Latha - 50k chit fund-07-25 Month 1	2025-07-11 14:52:29.265	2025-08-09 16:30:38.861	1	\N	1	18064	68564
99	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Mano - 50k chit fund-07-25 Month 1	2025-07-11 14:52:49.856	2025-08-09 16:30:39.168	1	\N	1	23064	73564
100	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Suryaprakash - 50k chit fund-07-25 Month 1	2025-07-11 14:53:11.308	2025-08-09 16:30:39.39	1	\N	1	28064	78564
102	LOAN_REPAYMENT	300	\N	\N	Mano	Mano	2025-07-11 00:00:00	Repayment from Sarath - Period 4	2025-07-11 15:08:56.718	2025-08-09 16:30:39.679	1	\N	1	28364	78864
181	AUCTION_PAYOUT	26000	\N	\N	Mano	Mano	2025-09-10 00:00:00	Auction payout to Prem - 30k chit fund-07-25 Month 3	2025-09-10 14:06:34.712	2025-09-10 14:06:34.712	1	1	\N	13734	25834
182	LOAN_REPAYMENT	3730	\N	\N	Mano	Mano	2025-09-10 00:00:00	Repayment from Sarath - Period 4	2025-09-10 14:08:49.213	2025-09-10 14:08:49.213	1	\N	1	17464	29564
183	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-09-10 14:09:15.33	Repayment from Sarath - Period 8	2025-09-10 14:09:19.853	2025-09-10 14:09:19.853	1	\N	1	19634	31734
168	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-08-30 00:00:00	Repayment from Arunkumar - Period 4	2025-09-05 13:23:44.704	2025-09-10 02:03:54.745	1	\N	2	8300	15484
184	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-09-11 00:00:00	Chit contribution from Manikandan - 50k chit fund-07-25 Month 3	2025-09-11 07:11:03.934	2025-09-11 07:11:03.934	1	\N	2	16900	36534
190	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-09-12 00:00:00	Repayment from Arunkumar - Period 5	2025-09-14 05:14:09.293	2025-09-14 05:14:09.293	1	\N	2	37900	48134
191	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-09-12 00:00:00	Repayment from Arunkumar - Period 6	2025-09-14 05:15:17.722	2025-09-14 05:15:17.722	1	\N	2	38900	49134
103	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-06-11 00:00:00	Repayment from Sarath - Period 5	2025-07-11 15:12:00.931	2025-08-09 16:30:39.987	1	\N	1	30534	81034
104	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-07-11 15:12:13.515	Repayment from Sarath - Period 6	2025-07-11 15:12:14.464	2025-08-09 16:30:40.295	1	\N	1	32704	83204
105	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Saraswathi - 30k chit fund-07-25 Month 1	2025-07-11 15:26:29.409	2025-08-09 16:30:40.602	1	\N	1	35704	86204
106	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Prem - 30k chit fund-07-25 Month 1	2025-07-11 15:26:52.737	2025-08-09 16:30:40.908	1	\N	1	38704	89204
107	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Chandrasekar - 30k chit fund-07-25 Month 1	2025-07-11 15:27:16.574	2025-08-09 16:30:41.216	1	\N	1	41704	92204
116	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-13 00:00:00	Repayment from Arunkumar - Period 13	2025-07-14 02:56:48.248	2025-08-09 16:30:43.383	1	\N	2	19000	31234
185	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-12 00:00:00	Chit contribution from Sudha Paramesh - 50k chit fund-07-25 Month 3	2025-09-13 05:24:34.44	2025-09-13 05:24:34.44	1	\N	1	24434	41334
186	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-09-13 05:25:27.726	Repayment from Mano - Period 5	2025-09-13 05:25:28.691	2025-09-13 05:25:28.691	1	\N	1	27234	44134
187	PARTNER_TO_PARTNER	20000	Mano	\N	Mano	Mano	2025-09-13 00:00:00	Transfer to Arul - for give manigndan 50 chit 3rd month	2025-09-14 01:02:55.213	2025-09-14 01:02:55.213	1	1	\N	7234	44134
188	PARTNER_TO_PARTNER	20000	\N	Arul	Mano	Mano	2025-09-13 00:00:00	Transfer from Mano - for give manigndan 50 chit 3rd month	2025-09-14 01:02:55.399	2025-09-14 01:02:55.399	1	\N	2	36900	44134
192	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-09-16 00:00:00	Chit contribution from THANGAPANDI - 50k chit fund-07-25 Month 3	2025-09-16 06:51:17.752	2025-09-16 06:51:17.752	1	\N	2	43700	53934
57	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 3	2025-07-07 08:34:34.592	2025-08-09 16:30:33.126	1	\N	2	-36650	-95810
81	RECORD_AMOUNT	43624	\N	Mano	Mano	Mano	2025-06-30 00:00:00	old amount reset	2025-07-11 07:26:49.936	2025-08-09 16:30:36.3	1	\N	1	-15536	20114
117	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-13 00:00:00	Repayment from Arunkumar - Period 14	2025-07-14 02:57:12.668	2025-08-09 16:30:43.674	1	\N	2	20000	32234
118	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-07-13 00:00:00	Repayment from Arunkumar - Period 4	2025-07-14 02:58:13.217	2025-08-09 16:30:43.981	1	\N	2	22200	34434
189	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-09-12 00:00:00	Chit contribution from Sarath - 30k chit fund-09-25 Month 1	2025-09-14 03:14:20.827	2025-09-14 03:14:20.827	1	\N	1	10234	47134
193	PARTNER_TO_PARTNER	3000	Mano	\N	Mano	Mano	2025-09-14 00:00:00	Transfer to Arul - for manigandan chit	2025-09-17 05:42:59.771	2025-09-17 05:42:59.771	1	1	\N	7234	53934
194	PARTNER_TO_PARTNER	3000	\N	Arul	Mano	Mano	2025-09-14 00:00:00	Transfer from Mano - for manigandan chit	2025-09-17 05:42:59.961	2025-09-17 05:42:59.961	1	\N	2	46700	53934
196	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-09-19 00:00:00	Repayment from Arunkumar - Period 9	2025-09-25 04:29:12.613	2025-09-25 04:29:12.613	1	\N	2	7800	15034
197	RECORD_AMOUNT	400	Mano	\N	Mano	Mano	2025-09-20 00:00:00	get-to-gether	2025-09-26 05:04:40.152	2025-09-26 05:04:40.152	1	1	\N	6834	14634
198	RECORD_AMOUNT	800	Arul	\N	Arul	Arul	2025-09-20 00:00:00	get-to-gether food	2025-09-26 05:05:12.243	2025-09-26 05:05:12.243	1	2	\N	7000	13834
109	AUCTION_PAYOUT	43000	\N	\N	Arul	Arul	2025-07-12 00:00:00	Auction payout to Arunkumar - 50k chit fund-07-25 Month 1	2025-07-12 11:52:15.018	2025-08-09 16:30:41.523	1	2	\N	7500	49204
110	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-12 00:00:00	Chit contribution from Arunkumar - 50k chit fund-07-25 Month 1	2025-07-13 14:29:29.091	2025-08-09 16:30:41.83	1	\N	2	12500	54204
111	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-12 00:00:00	Chit contribution from Sudha Paramesh - 50k chit fund-07-25 Month 1	2025-07-13 14:30:08.236	2025-08-09 16:30:42.138	1	\N	1	46704	59204
112	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-07-12 00:00:00	Repayment from Arunkumar - Period 7	2025-07-13 14:31:31.102	2025-08-09 16:30:42.362	1	\N	2	18000	64704
113	LOAN_REPAYMENT	3730	\N	\N	Mano	Mano	2025-07-13 00:00:00	Repayment from Sarath - Period 2	2025-07-13 14:36:18.849	2025-08-09 16:30:42.65	1	\N	1	50434	68434
115	AUCTION_PAYOUT	43000	\N	\N	Mano	Mano	2025-07-12 00:00:00	Auction payout to Sudha Paramesh - 50k chit fund-07-25 Month 1	2025-07-13 14:43:26.347	2025-08-09 16:30:43.161	1	1	\N	12234	30234
122	PARTNER_TO_PARTNER	19000	Mano	\N	Mano	Mano	2025-07-12 00:00:00	Transfer to Arul - for arun 1st month chit fund	2025-07-19 17:00:57.045	2025-08-09 16:30:45.21	1	1	\N	1034	47234
123	PARTNER_TO_PARTNER	19000	\N	Arul	Mano	Mano	2025-07-12 00:00:00	Transfer from Mano - for arun 1st month chit fund	2025-07-19 17:00:57.712	2025-08-09 16:30:45.517	1	\N	2	46200	47234
130	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-10 00:00:00	Repayment from Arunpandi - Period 11	2025-07-31 11:20:57.181	2025-08-09 16:30:47.258	1	\N	2	20260	50734
151	CHIT_CONTRIBUTION	2850	\N	\N	Mano	Mano	2025-08-12 00:00:00	Chit contribution from Chandrasekar - 30k chit fund-07-25 Month 2	2025-08-12 05:44:54.807	2025-08-12 05:44:54.807	1	\N	1	33524	37884
153	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-08-13 00:00:00	Chit contribution from THANGAPANDI - 50k chit fund-07-25 Month 2	2025-08-13 03:46:38.091	2025-08-13 03:46:38.091	1	\N	2	13960	47484
154	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-08-13 00:00:00	Chit contribution from Sudha Paramesh - 50k chit fund-07-25 Month 2	2025-08-13 05:25:47.496	2025-08-13 05:25:47.496	1	\N	1	38324	52284
155	PARTNER_TO_PARTNER	15000	Mano	\N	Mano	Mano	2025-08-13 00:00:00	Transfer to Arul - for given to thangapandi	2025-08-13 06:01:04.943	2025-08-13 06:01:04.943	1	1	\N	23324	52284
156	PARTNER_TO_PARTNER	15000	\N	Arul	Mano	Mano	2025-08-13 00:00:00	Transfer from Mano - for given to thangapandi	2025-08-13 06:01:05.209	2025-08-13 06:01:05.209	1	\N	2	28960	52284
159	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-08-13 06:21:20.63	Repayment from Mano - Period 4	2025-08-13 06:21:21.699	2025-08-13 06:21:21.699	1	\N	1	32024	60984
160	AUCTION_PAYOUT	25500	\N	\N	Mano	Mano	2025-08-13 00:00:00	Auction payout to Saraswathi - 30k chit fund-07-25 Month 2	2025-08-13 06:22:04.332	2025-08-13 06:22:04.332	1	1	\N	6524	35484
161	AUCTION_PAYOUT	43700	\N	\N	Arul	Arul	2025-08-17 00:00:00	Auction payout to THANGAPANDI - 50k chit fund-07-25 Month 2	2025-08-19 07:15:08.19	2025-08-19 07:15:08.19	1	2	\N	-14740	-8216
163	RECORD_AMOUNT	9600	\N	Arul	Arul	Arul	2025-08-19 00:00:00	thangapandi old chit fund balance	2025-08-19 07:53:37.565	2025-08-19 07:53:37.565	1	\N	2	-4140	2384
131	PARTNER_TO_PARTNER	8000	Mano	\N	Mano	Mano	2025-07-31 00:00:00	Transfer to Arul - for arun weekly loan amount	2025-08-01 02:35:34.378	2025-08-09 16:30:47.789	1	1	\N	22474	50734
132	PARTNER_TO_PARTNER	8000	\N	Arul	Mano	Mano	2025-07-31 00:00:00	Transfer from Mano - for arun weekly loan amount	2025-08-01 02:35:34.559	2025-08-09 16:30:48.077	1	\N	2	28260	50734
133	LOAN_DISBURSEMENT	20000	\N	\N	Arul	Arul	2025-07-31 00:00:00	Loan disbursed to Arunkumar	2025-08-04 13:38:16.199	2025-08-09 16:30:48.385	1	2	\N	8260	30734
134	PARTNER_TO_PARTNER	8500	Mano	\N	Arul	Arul	2025-08-04 00:00:00	Transfer to Arul - for arun 20k weekly loan remaing balance	2025-08-04 13:40:50.533	2025-08-09 16:30:48.692	1	1	\N	13974	30734
135	PARTNER_TO_PARTNER	8500	\N	Arul	Arul	Arul	2025-08-04 00:00:00	Transfer from Mano - for arun 20k weekly loan remaing balance	2025-08-04 13:40:51.076	2025-08-09 16:30:48.999	1	\N	2	16760	30734
136	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-08-06 00:00:00	Repayment from Arunkumar - Period 5	2025-08-06 16:39:14.426	2025-08-09 16:30:49.306	1	\N	2	18960	32934
137	AUCTION_PAYOUT	43000	\N	\N	Arul	Arul	2025-08-07 00:00:00	Auction payout to Rajaram - 50k chit fund-07-25 Month 1	2025-08-07 03:22:56.549	2025-08-09 16:30:49.613	1	2	\N	-24040	-10066
140	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-08-06 00:00:00	Chit contribution from Rajaram - 50k chit fund-07-25 Month 2	2025-08-08 08:01:09.76	2025-08-09 16:30:50.535	1	\N	2	-6240	-5266
141	CHIT_CONTRIBUTION	4800	\N	\N	Arul	Arul	2025-08-07 00:00:00	Chit contribution from Arunkumar - 50k chit fund-07-25 Month 2	2025-08-09 13:57:14.16	2025-08-09 16:30:50.842	1	\N	2	-1440	-466
144	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Dhurga - 50k chit fund-07-25 Month 2	2025-08-11 23:52:46.396	2025-08-11 23:52:46.396	1	\N	1	5774	10134
164	PARTNER_TO_PARTNER	4140	Mano	\N	Mano	Mano	2025-08-19 00:00:00	Transfer to Arul - after thangapandi chit fund balance tally arul to 0	2025-08-19 07:55:45.014	2025-08-19 07:55:45.014	1	1	\N	2384	2384
165	PARTNER_TO_PARTNER	4140	\N	Arul	Mano	Mano	2025-08-19 00:00:00	Transfer from Mano - after thangapandi chit fund balance tally arul to 0	2025-08-19 07:55:45.17	2025-08-19 07:55:45.17	1	\N	2	0	2384
2	LOAN_DISBURSEMENT	20000	\N	\N	Arul	Arul	2024-09-16 00:00:00	Loan disbursed to Kaviyarasu	2025-07-04 07:00:31.386	2025-08-09 16:30:19.442	1	2	\N	-30000	-30000
145	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Kaviya - 50k chit fund-07-25 Month 2	2025-08-11 23:53:04.483	2025-08-11 23:53:04.483	1	\N	1	10574	14934
146	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-08-11 00:00:00	Chit contribution from Latha - 50k chit fund-07-25 Month 2	2025-08-11 23:53:17.835	2025-08-11 23:53:17.835	1	\N	1	15374	19734
166	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-08-21 00:00:00	Repayment from Arunkumar - Period 3	2025-08-21 06:16:44.94	2025-08-21 06:16:44.94	1	\N	2	1000	3384
167	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-08-21 00:00:00	Repayment from Arunkumar - Period 8	2025-08-21 06:19:37.492	2025-08-21 06:19:37.492	1	\N	2	1500	3884
170	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-09 00:00:00	Chit contribution from Rajaram - 50k chit fund-07-25 Month 3	2025-09-09 13:52:11.189	2025-09-09 13:52:11.189	1	\N	1	7184	14484
173	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Dhurga - 50k chit fund-07-25 Month 3	2025-09-10 02:44:26.76	2025-09-10 02:44:26.76	1	\N	1	11984	24084
175	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Latha - 50k chit fund-07-25 Month 3	2025-09-10 02:44:55.882	2025-09-10 02:44:55.882	1	\N	1	21584	33684
176	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Mano - 50k chit fund-07-25 Month 3	2025-09-10 02:45:11.247	2025-09-10 02:45:11.247	1	\N	1	26384	38484
177	CHIT_CONTRIBUTION	4800	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Suryaprakash - 50k chit fund-07-25 Month 3	2025-09-10 02:45:29.015	2025-09-10 02:45:29.015	1	\N	1	31184	43284
179	CHIT_CONTRIBUTION	2850	\N	\N	Mano	Mano	2025-09-10 00:00:00	Chit contribution from Chandrasekar - 30k chit fund-07-25 Month 3	2025-09-10 08:52:16.759	2025-09-10 08:52:16.759	1	\N	1	36884	48984
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."User" (id, name, email, password, role, "createdAt", "updatedAt") FROM stdin;
1	Admin	amfincorp1@gmail.com	$2b$10$3mjgpRMGxvBHwjReJj1IluTTIpbECocnJQK4TK5nolz7.pF0MQMdS	admin	2025-07-04 06:21:22.237	2025-07-04 06:21:22.237
\.


--
-- Name: Auction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Auction_id_seq"', 7, true);


--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."ChitFundFixedAmount_id_seq"', 50, true);


--
-- Name: ChitFund_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."ChitFund_id_seq"', 5, true);


--
-- Name: Contribution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Contribution_id_seq"', 61, true);


--
-- Name: EmailLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."EmailLog_id_seq"', 1, false);


--
-- Name: GlobalMember_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."GlobalMember_id_seq"', 20, true);


--
-- Name: Loan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Loan_id_seq"', 12, true);


--
-- Name: Member_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Member_id_seq"', 18, true);


--
-- Name: Partner_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Partner_id_seq"', 2, true);


--
-- Name: PaymentSchedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."PaymentSchedule_id_seq"', 1, false);


--
-- Name: Repayment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Repayment_id_seq"', 90, true);


--
-- Name: Transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Transaction_id_seq"', 200, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."User_id_seq"', 1, true);


--
-- Name: Auction Auction_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_pkey" PRIMARY KEY (id);


--
-- Name: ChitFundFixedAmount ChitFundFixedAmount_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ChitFundFixedAmount"
    ADD CONSTRAINT "ChitFundFixedAmount_pkey" PRIMARY KEY (id);


--
-- Name: ChitFund ChitFund_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ChitFund"
    ADD CONSTRAINT "ChitFund_pkey" PRIMARY KEY (id);


--
-- Name: Contribution Contribution_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: GlobalMember GlobalMember_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."GlobalMember"
    ADD CONSTRAINT "GlobalMember_pkey" PRIMARY KEY (id);


--
-- Name: Loan Loan_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_pkey" PRIMARY KEY (id);


--
-- Name: Member Member_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_pkey" PRIMARY KEY (id);


--
-- Name: Partner Partner_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partner"
    ADD CONSTRAINT "Partner_pkey" PRIMARY KEY (id);


--
-- Name: PaymentSchedule PaymentSchedule_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PaymentSchedule"
    ADD CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY (id);


--
-- Name: Repayment Repayment_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Auction_chitFundId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Auction_chitFundId_idx" ON public."Auction" USING btree ("chitFundId");


--
-- Name: Auction_disbursed_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Auction_disbursed_by_id_idx" ON public."Auction" USING btree (disbursed_by_id);


--
-- Name: Auction_entered_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Auction_entered_by_id_idx" ON public."Auction" USING btree (entered_by_id);


--
-- Name: Auction_transactionId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Auction_transactionId_idx" ON public."Auction" USING btree ("transactionId");


--
-- Name: Auction_transactionId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Auction_transactionId_key" ON public."Auction" USING btree ("transactionId");


--
-- Name: Auction_winnerId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Auction_winnerId_idx" ON public."Auction" USING btree ("winnerId");


--
-- Name: ChitFundFixedAmount_chitFundId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ChitFundFixedAmount_chitFundId_idx" ON public."ChitFundFixedAmount" USING btree ("chitFundId");


--
-- Name: ChitFundFixedAmount_chitFundId_month_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "ChitFundFixedAmount_chitFundId_month_key" ON public."ChitFundFixedAmount" USING btree ("chitFundId", month);


--
-- Name: ChitFund_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ChitFund_createdById_idx" ON public."ChitFund" USING btree ("createdById");


--
-- Name: Contribution_chitFundId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Contribution_chitFundId_idx" ON public."Contribution" USING btree ("chitFundId");


--
-- Name: Contribution_collected_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Contribution_collected_by_id_idx" ON public."Contribution" USING btree (collected_by_id);


--
-- Name: Contribution_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Contribution_createdById_idx" ON public."Contribution" USING btree ("createdById");


--
-- Name: Contribution_entered_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Contribution_entered_by_id_idx" ON public."Contribution" USING btree (entered_by_id);


--
-- Name: Contribution_memberId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Contribution_memberId_idx" ON public."Contribution" USING btree ("memberId");


--
-- Name: Contribution_transactionId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Contribution_transactionId_idx" ON public."Contribution" USING btree ("transactionId");


--
-- Name: Contribution_transactionId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Contribution_transactionId_key" ON public."Contribution" USING btree ("transactionId");


--
-- Name: EmailLog_emailType_period_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "EmailLog_emailType_period_key" ON public."EmailLog" USING btree ("emailType", period);


--
-- Name: EmailLog_emailType_sentDate_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "EmailLog_emailType_sentDate_idx" ON public."EmailLog" USING btree ("emailType", "sentDate");


--
-- Name: GlobalMember_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "GlobalMember_createdById_idx" ON public."GlobalMember" USING btree ("createdById");


--
-- Name: Loan_borrowerId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Loan_borrowerId_idx" ON public."Loan" USING btree ("borrowerId");


--
-- Name: Loan_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Loan_createdById_idx" ON public."Loan" USING btree ("createdById");


--
-- Name: Loan_disbursed_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Loan_disbursed_by_id_idx" ON public."Loan" USING btree (disbursed_by_id);


--
-- Name: Loan_entered_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Loan_entered_by_id_idx" ON public."Loan" USING btree (entered_by_id);


--
-- Name: Loan_transactionId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Loan_transactionId_idx" ON public."Loan" USING btree ("transactionId");


--
-- Name: Loan_transactionId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Loan_transactionId_key" ON public."Loan" USING btree ("transactionId");


--
-- Name: Member_chitFundId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Member_chitFundId_idx" ON public."Member" USING btree ("chitFundId");


--
-- Name: Member_globalMemberId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Member_globalMemberId_idx" ON public."Member" USING btree ("globalMemberId");


--
-- Name: Partner_createdById_code_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Partner_createdById_code_key" ON public."Partner" USING btree ("createdById", code);


--
-- Name: Partner_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Partner_createdById_idx" ON public."Partner" USING btree ("createdById");


--
-- Name: PaymentSchedule_loanId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "PaymentSchedule_loanId_idx" ON public."PaymentSchedule" USING btree ("loanId");


--
-- Name: Repayment_collected_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Repayment_collected_by_id_idx" ON public."Repayment" USING btree (collected_by_id);


--
-- Name: Repayment_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Repayment_createdById_idx" ON public."Repayment" USING btree ("createdById");


--
-- Name: Repayment_entered_by_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Repayment_entered_by_id_idx" ON public."Repayment" USING btree (entered_by_id);


--
-- Name: Repayment_loanId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Repayment_loanId_idx" ON public."Repayment" USING btree ("loanId");


--
-- Name: Repayment_paidDate_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Repayment_paidDate_idx" ON public."Repayment" USING btree ("paidDate");


--
-- Name: Repayment_transactionId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Repayment_transactionId_idx" ON public."Repayment" USING btree ("transactionId");


--
-- Name: Repayment_transactionId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Repayment_transactionId_key" ON public."Repayment" USING btree ("transactionId");


--
-- Name: Transaction_createdById_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Transaction_createdById_idx" ON public."Transaction" USING btree ("createdById");


--
-- Name: Transaction_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Transaction_date_idx" ON public."Transaction" USING btree (date);


--
-- Name: Transaction_from_partner_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Transaction_from_partner_id_idx" ON public."Transaction" USING btree (from_partner_id);


--
-- Name: Transaction_to_partner_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Transaction_to_partner_id_idx" ON public."Transaction" USING btree (to_partner_id);


--
-- Name: Transaction_type_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Transaction_type_idx" ON public."Transaction" USING btree (type);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Auction Auction_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Auction Auction_disbursed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_disbursed_by_id_fkey" FOREIGN KEY (disbursed_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auction Auction_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auction Auction_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auction Auction_winnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChitFundFixedAmount ChitFundFixedAmount_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ChitFundFixedAmount"
    ADD CONSTRAINT "ChitFundFixedAmount_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChitFund ChitFund_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ChitFund"
    ADD CONSTRAINT "ChitFund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contribution Contribution_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contribution Contribution_collected_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_collected_by_id_fkey" FOREIGN KEY (collected_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contribution Contribution_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contribution Contribution_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contribution Contribution_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contribution Contribution_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GlobalMember GlobalMember_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."GlobalMember"
    ADD CONSTRAINT "GlobalMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_borrowerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES public."GlobalMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_disbursed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_disbursed_by_id_fkey" FOREIGN KEY (disbursed_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Member Member_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Member Member_globalMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_globalMemberId_fkey" FOREIGN KEY ("globalMemberId") REFERENCES public."GlobalMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Partner Partner_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Partner"
    ADD CONSTRAINT "Partner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentSchedule PaymentSchedule_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."PaymentSchedule"
    ADD CONSTRAINT "PaymentSchedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Repayment Repayment_collected_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_collected_by_id_fkey" FOREIGN KEY (collected_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Repayment Repayment_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Repayment Repayment_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Repayment Repayment_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Repayment Repayment_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Transaction Transaction_from_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_from_partner_id_fkey" FOREIGN KEY (from_partner_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_to_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_to_partner_id_fkey" FOREIGN KEY (to_partner_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

