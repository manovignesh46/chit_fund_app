--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
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
\.


--
-- Data for Name: ChitFund; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ChitFund" (id, name, "totalAmount", "monthlyContribution", "firstMonthContribution", duration, "membersCount", status, "startDate", "currentMonth", "nextAuctionDate", description, "chitFundType", "createdAt", "updatedAt", "createdById") FROM stdin;
3	30k chit fund-07-25	30000	2850	3000	10	10	Active	2025-07-10 00:00:00	1	\N	\N	Fixed	2025-07-10 15:05:39.201	2025-07-10 15:05:39.201	1
2	50k chit fund-07-25	50000	4800	5000	10	10	Active	2025-07-10 00:00:00	1	\N	\N	Fixed	2025-07-10 14:37:33.5	2025-07-13 14:43:27.185	1
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
\.


--
-- Data for Name: Loan; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Loan" (id, "borrowerId", "loanType", amount, "interestRate", "documentCharge", "currentMonth", "installmentAmount", duration, "disbursementDate", "repaymentType", "remainingAmount", "overdueAmount", "missedPayments", "nextPaymentDate", status, purpose, "createdAt", "updatedAt", "createdById", disbursed_by_id, entered_by_id, "transactionId") FROM stdin;
4	1	Weekly	15000	0	0	16	1000	17	2025-03-31 00:00:00	Weekly	1000	1000	1	2025-07-14 00:00:00	Active	personal	2025-07-04 07:25:25.559	2025-07-15 16:05:14.518	1	2	2	19
3	1	Monthly	25000	500	1500	8	5500	8	2024-11-11 00:00:00	Monthly	5000	5500	1	2025-07-11 00:00:00	Active	personal	2025-07-04 07:01:42.927	2025-07-15 16:07:52.023	1	2	2	3
10	6	Monthly	20000	400	1000	3	3730	6	2025-05-06 00:00:00	Monthly	13340	0	0	2025-08-06 00:00:00	Active	personal	2025-07-04 08:01:30.798	2025-07-14 02:55:27.896	1	1	1	51
1	1	Monthly	10000	200	0	5	2200	5	2025-03-01 00:00:00	Monthly	2000	0	0	2025-08-01 00:00:00	Active	personal	2025-07-04 06:57:33.134	2025-07-15 16:13:23.199	1	2	2	1
8	6	Monthly	15000	300	500	7	2170	9	2025-01-11 00:00:00	Monthly	5650	0	0	2025-08-11 00:00:00	Active	personal	2025-07-04 07:56:51.256	2025-07-19 07:21:56.175	1	1	1	43
9	5	Monthly	40000	800	0	4	2800	20	2025-04-15 00:00:00	Monthly	34000	0	0	2025-08-15 00:00:00	Active	2l loan repayment	2025-07-04 07:59:32.353	2025-07-19 07:21:59.979	1	1	1	48
11	2	Weekly	5000	0	0	11	500	11	2025-04-24 00:00:00	Weekly	-500	0	0	\N	Completed	Personal Loan 	2025-07-07 08:31:48.737	2025-07-11 14:47:04.17	1	2	2	53
2	4	Monthly	20000	600	0	10	2600	15	2024-09-16 00:00:00	Monthly	20000	10400	4	2025-03-16 00:00:00	Active	personal	2025-07-04 07:00:31.386	2025-07-06 08:33:14.034	1	2	2	2
5	3	Monthly	26000	500	1000	6	4850	6	2025-01-12 00:00:00	Monthly	-100	0	0	\N	Active	personal	2025-07-04 07:45:55.174	2025-07-11 14:48:06.682	1	2	2	31
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
58	500	2025-07-07 00:00:00	11	11	2025-07-11 14:46:57.563	2025-07-11 14:46:57.563	REGULAR	2	1	2	92
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
\.


--
-- Data for Name: Transaction; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Transaction" (id, type, amount, from_partner, to_partner, action_performer, entered_by, date, note, "createdAt", "updatedAt", "createdById", from_partner_id, to_partner_id, "partnerBalance", "totalBalance") FROM stdin;
1	LOAN_DISBURSEMENT	10000	\N	\N	Arul	Arul	2025-03-01 00:00:00	Loan disbursed to Arunkumar	2025-07-04 06:57:33.134	2025-07-04 06:57:33.134	1	2	\N	0	0
2	LOAN_DISBURSEMENT	20000	\N	\N	Arul	Arul	2024-09-16 00:00:00	Loan disbursed to Kaviyarasu	2025-07-04 07:00:31.386	2025-07-04 07:00:31.386	1	2	\N	0	0
3	LOAN_DISBURSEMENT	25000	\N	\N	Arul	Arul	2024-11-11 00:00:00	Loan disbursed to Arunkumar	2025-07-04 07:01:42.927	2025-07-04 07:01:42.927	1	2	\N	0	0
4	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-04-01 00:00:00	Repayment from Arunkumar - Period 1	2025-07-04 07:03:01.042	2025-07-04 07:03:01.042	1	\N	2	0	0
5	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-05-01 00:00:00	Repayment from Arunkumar - Period 2	2025-07-04 07:03:21.152	2025-07-04 07:03:21.152	1	\N	2	0	0
6	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-06-06 00:00:00	Repayment from Arunkumar - Period 3	2025-07-04 07:03:47.377	2025-07-04 07:03:47.377	1	\N	2	0	0
8	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2024-10-16 00:00:00	Repayment from Kaviyarasu - Period 1	2025-07-04 07:12:27.421	2025-07-04 07:12:27.421	1	\N	2	0	0
9	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2024-11-16 00:00:00	Repayment from Kaviyarasu - Period 2	2025-07-04 07:12:52.405	2025-07-04 07:12:52.405	1	\N	2	0	0
10	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2025-04-12 00:00:00	Repayment from Kaviyarasu - Period 3	2025-07-04 07:13:19.48	2025-07-04 07:13:19.48	1	\N	2	0	0
11	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2025-04-12 00:00:00	Repayment from Kaviyarasu - Period 4	2025-07-04 07:13:41.791	2025-07-04 07:13:41.791	1	\N	2	0	0
12	LOAN_REPAYMENT	600	\N	\N	Arul	Arul	2025-05-15 00:00:00	Repayment from Kaviyarasu - Period 5	2025-07-04 07:14:11.485	2025-07-04 07:14:11.485	1	\N	2	0	0
13	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-01-10 00:00:00	Repayment from Arunkumar - Period 1	2025-07-04 07:14:59.062	2025-07-04 07:14:59.062	1	\N	2	0	0
14	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-02-10 00:00:00	Repayment from Arunkumar - Period 2	2025-07-04 07:15:17.218	2025-07-04 07:15:17.218	1	\N	2	0	0
15	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-03-10 00:00:00	Repayment from Arunkumar - Period 3	2025-07-04 07:15:54.201	2025-07-04 07:15:54.201	1	\N	2	0	0
16	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-04-14 00:00:00	Repayment from Arunkumar - Period 4	2025-07-04 07:23:00.767	2025-07-04 07:23:00.767	1	\N	2	0	0
17	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-05-11 00:00:00	Repayment from Arunkumar - Period 5	2025-07-04 07:23:23.822	2025-07-04 07:23:23.822	1	\N	2	0	0
18	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-09 00:00:00	Repayment from Arunkumar - Period 6	2025-07-04 07:23:45.66	2025-07-04 07:23:45.66	1	\N	2	0	0
19	LOAN_DISBURSEMENT	15000	\N	\N	Arul	Arul	2025-03-31 00:00:00	Loan disbursed to Arunkumar	2025-07-04 07:25:25.559	2025-07-04 07:25:25.559	1	2	\N	0	0
20	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-07 00:00:00	Repayment from Arunkumar - Period 1	2025-07-04 07:31:43.276	2025-07-04 07:31:43.276	1	\N	2	0	0
21	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-14 00:00:00	Repayment from Arunkumar - Period 2	2025-07-04 07:32:14.953	2025-07-04 07:32:14.953	1	\N	2	0	0
22	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-21 00:00:00	Repayment from Arunkumar - Period 3	2025-07-04 07:32:34.54	2025-07-04 07:32:34.54	1	\N	2	0	0
23	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-04-28 00:00:00	Repayment from Arunkumar - Period 4	2025-07-04 07:32:51.467	2025-07-04 07:32:51.467	1	\N	2	0	0
24	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-06 00:00:00	Repayment from Arunkumar - Period 5	2025-07-04 07:33:11.008	2025-07-04 07:33:11.008	1	\N	2	0	0
25	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-13 00:00:00	Repayment from Arunkumar - Period 6	2025-07-04 07:33:27.478	2025-07-04 07:33:27.478	1	\N	2	0	0
26	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-19 00:00:00	Repayment from Arunkumar - Period 7	2025-07-04 07:33:57.053	2025-07-04 07:33:57.053	1	\N	2	0	0
27	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-05-27 00:00:00	Repayment from Arunkumar - Period 8	2025-07-04 07:34:13.096	2025-07-04 07:34:13.096	1	\N	2	0	0
28	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-09 00:00:00	Repayment from Arunkumar - Period 9	2025-07-04 07:35:07.185	2025-07-04 07:35:07.185	1	\N	2	0	0
29	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-09 00:00:00	Repayment from Arunkumar - Period 10	2025-07-04 07:35:43.361	2025-07-04 07:35:43.361	1	\N	2	0	0
30	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-19 00:00:00	Repayment from Arunkumar - Period 11	2025-07-04 07:36:07.692	2025-07-04 07:36:07.692	1	\N	2	0	0
31	LOAN_DISBURSEMENT	26000	\N	\N	Arul	Arul	2025-01-12 00:00:00	Loan disbursed to Bhuvanesh	2025-07-04 07:45:55.174	2025-07-04 07:45:55.174	1	2	\N	0	0
32	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-02-12 00:00:00	Repayment from Bhuvanesh - Period 1	2025-07-04 07:46:21.997	2025-07-04 07:46:21.997	1	\N	2	0	0
33	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-03-12 00:00:00	Repayment from Bhuvanesh - Period 2	2025-07-04 07:46:41.695	2025-07-04 07:46:41.695	1	\N	2	0	0
34	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-04-12 00:00:00	Repayment from Bhuvanesh - Period 3	2025-07-04 07:47:03.47	2025-07-04 07:47:03.47	1	\N	2	0	0
35	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-05-12 00:00:00	Repayment from Bhuvanesh - Period 4	2025-07-04 07:47:41.335	2025-07-04 07:47:41.335	1	\N	2	0	0
36	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-06-12 00:00:00	Repayment from Bhuvanesh - Period 5	2025-07-04 07:48:00.277	2025-07-04 07:48:00.277	1	\N	2	0	0
43	LOAN_DISBURSEMENT	15000	\N	\N	Mano	Mano	2025-01-11 00:00:00	Loan disbursed to Sarath	2025-07-04 07:56:51.256	2025-07-04 07:56:51.256	1	1	\N	0	0
44	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-02-11 00:00:00	Repayment from Sarath - Period 1	2025-07-04 07:57:26.596	2025-07-04 07:57:26.596	1	\N	1	0	0
45	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-03-11 00:00:00	Repayment from Sarath - Period 2	2025-07-04 07:57:45.624	2025-07-04 07:57:45.624	1	\N	1	0	0
46	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-04-05 00:00:00	Repayment from Sarath - Period 3	2025-07-04 07:58:16.903	2025-07-04 07:58:16.903	1	\N	1	0	0
48	LOAN_DISBURSEMENT	40000	\N	\N	Mano	Mano	2025-04-15 00:00:00	Loan disbursed to Mano	2025-07-04 07:59:32.353	2025-07-04 07:59:32.353	1	1	\N	0	0
49	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-05-15 00:00:00	Repayment from Mano - Period 1	2025-07-04 07:59:57.99	2025-07-04 07:59:57.99	1	\N	1	0	0
50	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-06-15 00:00:00	Repayment from Mano - Period 2	2025-07-04 08:00:16.996	2025-07-04 08:00:16.996	1	\N	1	0	0
51	LOAN_DISBURSEMENT	20000	\N	\N	Mano	Mano	2025-05-06 00:00:00	Loan disbursed to Sarath	2025-07-04 08:01:30.798	2025-07-04 08:01:30.798	1	1	\N	0	0
52	LOAN_REPAYMENT	3730	\N	\N	Mano	Mano	2025-06-12 00:00:00	Repayment from Sarath - Period 1	2025-07-04 08:02:51.641	2025-07-04 08:02:51.641	1	\N	1	0	0
53	LOAN_DISBURSEMENT	5000	\N	\N	Arul	Arul	2025-04-24 00:00:00	Loan disbursed to Arunpandi	2025-07-07 08:31:48.737	2025-07-07 08:31:48.737	1	2	\N	0	0
55	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 1	2025-07-07 08:33:02.762	2025-07-07 08:33:02.762	1	\N	2	0	0
56	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 2	2025-07-07 08:33:25.858	2025-07-07 08:33:25.858	1	\N	2	0	0
57	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 3	2025-07-07 08:34:34.592	2025-07-07 08:34:34.592	1	\N	2	0	0
58	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 7	2025-07-07 08:36:30.23	2025-07-07 08:36:30.23	1	\N	2	0	0
59	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 6	2025-07-07 08:37:20.147	2025-07-07 08:37:20.147	1	\N	2	0	0
61	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 8	2025-07-07 08:38:35.15	2025-07-07 08:38:35.15	1	\N	2	0	0
62	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 4	2025-07-07 08:39:12.046	2025-07-07 08:39:12.046	1	\N	2	0	0
63	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-06-07 00:00:00	Repayment from Arunpandi - Period 5	2025-07-07 08:39:41.929	2025-07-07 08:39:41.929	1	\N	2	0	0
64	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 9	2025-07-07 08:42:10.757	2025-07-07 08:42:10.757	1	\N	2	0	0
65	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 10	2025-07-07 08:44:06.508	2025-07-07 08:44:06.508	1	\N	2	0	0
76	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-06-24 00:00:00	Repayment from Arunkumar - Period 12	2025-07-11 07:04:16.306	2025-07-11 07:04:16.306	1	\N	2	0	0
78	PARTNER_TO_PARTNER	29440	Arul	Mano	Arul	Arul	2025-06-30 00:00:00		2025-07-11 07:16:15.789	2025-07-11 07:16:15.789	1	2	1	0	0
79	RECORD_AMOUNT	55380	\N	Arul	Arul	Arul	2025-06-30 00:00:00	old amount reset	2025-07-11 07:24:28.558	2025-07-11 07:24:28.558	1	\N	2	0	0
80	RECORD_AMOUNT	12420	\N	Arul	Arul	Arul	2025-06-30 00:00:00	old amount reset	2025-07-11 07:25:15.262	2025-07-11 07:25:15.262	1	\N	2	0	0
81	RECORD_AMOUNT	43624	\N	Mano	Mano	Mano	2025-06-30 00:00:00	old amount reset	2025-07-11 07:26:49.936	2025-07-11 07:26:49.936	1	\N	1	0	0
84	RECORD_AMOUNT	4800	\N	Mano	Mano	Mano	2025-07-11 00:00:00	abi previous 50k chit last amount	2025-07-11 07:32:18.542	2025-07-11 07:32:18.542	1	\N	1	0	0
90	RECORD_AMOUNT	9000	\N	Mano	Mano	Mano	2025-06-30 00:00:00	tally old remaining balance	2025-07-11 14:41:38.868	2025-07-11 14:41:38.868	1	\N	1	0	0
91	RECORD_AMOUNT	4800	\N	Mano	Mano	Mano	2025-06-30 00:00:00	for tally old remaing balnce(alrady updated abi 50k last fnud)	2025-07-11 14:43:05.757	2025-07-11 14:43:05.757	1	\N	1	0	0
92	LOAN_REPAYMENT	500	\N	\N	Arul	Arul	2025-07-07 00:00:00	Repayment from Arunpandi - Period 11	2025-07-11 14:46:57.563	2025-07-11 14:46:57.563	1	\N	2	0	0
93	LOAN_REPAYMENT	4850	\N	\N	Arul	Arul	2025-07-10 00:00:00	Repayment from Bhuvanesh - Period 6	2025-07-11 14:48:00.467	2025-07-11 14:48:00.467	1	\N	2	0	0
94	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-07 00:00:00	Chit contribution from Manikandan - 50k chit fund-07-25 Month 1	2025-07-11 14:50:43.15	2025-07-11 14:50:43.15	1	\N	2	0	0
95	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-05 00:00:00	Chit contribution from Santhosh - 50k chit fund-07-25 Month 1	2025-07-11 14:51:12.877	2025-07-11 14:51:12.877	1	\N	2	0	0
96	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Dhurga - 50k chit fund-07-25 Month 1	2025-07-11 14:51:42.267	2025-07-11 14:51:42.267	1	\N	1	0	0
97	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Kaviya - 50k chit fund-07-25 Month 1	2025-07-11 14:52:04.823	2025-07-11 14:52:04.823	1	\N	1	0	0
98	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Latha - 50k chit fund-07-25 Month 1	2025-07-11 14:52:29.265	2025-07-11 14:52:29.265	1	\N	1	0	0
99	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Mano - 50k chit fund-07-25 Month 1	2025-07-11 14:52:49.856	2025-07-11 14:52:49.856	1	\N	1	0	0
100	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Suryaprakash - 50k chit fund-07-25 Month 1	2025-07-11 14:53:11.308	2025-07-11 14:53:11.308	1	\N	1	0	0
102	LOAN_REPAYMENT	300	\N	\N	Mano	Mano	2025-07-11 00:00:00	Repayment from Sarath - Period 4	2025-07-11 15:08:56.718	2025-07-11 15:08:56.718	1	\N	1	0	0
103	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-06-11 00:00:00	Repayment from Sarath - Period 5	2025-07-11 15:12:00.931	2025-07-11 15:12:00.931	1	\N	1	0	0
104	LOAN_REPAYMENT	2170	\N	\N	Mano	Mano	2025-07-11 15:12:13.515	Repayment from Sarath - Period 6	2025-07-11 15:12:14.464	2025-07-11 15:12:14.464	1	\N	1	0	0
105	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Saraswathi - 30k chit fund-07-25 Month 1	2025-07-11 15:26:29.409	2025-07-11 15:26:29.409	1	\N	1	0	0
106	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Prem - 30k chit fund-07-25 Month 1	2025-07-11 15:26:52.737	2025-07-11 15:26:52.737	1	\N	1	0	0
107	CHIT_CONTRIBUTION	3000	\N	\N	Mano	Mano	2025-07-11 00:00:00	Chit contribution from Chandrasekar - 30k chit fund-07-25 Month 1	2025-07-11 15:27:16.574	2025-07-11 15:27:16.574	1	\N	1	0	0
108	PARTNER_TO_PARTNER	19000	Mano	Arul	Mano	Mano	2025-07-12 00:00:00	For arun 1st month chit fund	2025-07-12 11:49:00.758	2025-07-12 11:49:00.758	1	1	2	0	0
109	AUCTION_PAYOUT	43000	\N	\N	Arul	Arul	2025-07-12 00:00:00	Auction payout to Arunkumar - 50k chit fund-07-25 Month 1	2025-07-12 11:52:15.018	2025-07-12 11:52:15.018	1	2	\N	0	0
110	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-12 00:00:00	Chit contribution from Arunkumar - 50k chit fund-07-25 Month 1	2025-07-13 14:29:29.091	2025-07-13 14:29:29.091	1	\N	2	0	0
111	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-12 00:00:00	Chit contribution from Sudha Paramesh - 50k chit fund-07-25 Month 1	2025-07-13 14:30:08.236	2025-07-13 14:30:08.236	1	\N	1	0	0
112	LOAN_REPAYMENT	5500	\N	\N	Arul	Arul	2025-07-12 00:00:00	Repayment from Arunkumar - Period 7	2025-07-13 14:31:31.102	2025-07-13 14:31:31.102	1	\N	2	0	0
113	LOAN_REPAYMENT	3730	\N	\N	Mano	Mano	2025-07-13 00:00:00	Repayment from Sarath - Period 2	2025-07-13 14:36:18.849	2025-07-13 14:36:18.849	1	\N	1	0	0
114	RECORD_AMOUNT	4800	\N	Mano	Mano	Mano	2025-07-12 00:00:00	Sudha paramesh old 50k last due	2025-07-13 14:42:14.362	2025-07-13 14:42:14.362	1	\N	1	0	0
115	AUCTION_PAYOUT	43000	\N	\N	Mano	Mano	2025-07-12 00:00:00	Auction payout to Sudha Paramesh - 50k chit fund-07-25 Month 1	2025-07-13 14:43:26.347	2025-07-13 14:43:26.347	1	1	\N	0	0
116	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-13 00:00:00	Repayment from Arunkumar - Period 13	2025-07-14 02:56:48.248	2025-07-14 02:56:48.248	1	\N	2	0	0
117	LOAN_REPAYMENT	1000	\N	\N	Arul	Arul	2025-07-13 00:00:00	Repayment from Arunkumar - Period 14	2025-07-14 02:57:12.668	2025-07-14 02:57:12.668	1	\N	2	0	0
118	LOAN_REPAYMENT	2200	\N	\N	Arul	Arul	2025-07-13 00:00:00	Repayment from Arunkumar - Period 4	2025-07-14 02:58:13.217	2025-07-14 02:58:13.217	1	\N	2	0	0
119	LOAN_REPAYMENT	2800	\N	\N	Mano	Mano	2025-07-15 15:59:39.874	Repayment from Mano - Period 3	2025-07-15 15:59:40.51	2025-07-15 15:59:40.51	1	\N	1	0	0
120	CHIT_CONTRIBUTION	5000	\N	\N	Arul	Arul	2025-07-15 00:00:00	Chit contribution from THANGAPANDI - 50k chit fund-07-25 Month 1	2025-07-15 16:02:58.2	2025-07-15 16:02:58.2	1	\N	2	0	0
121	CHIT_CONTRIBUTION	5000	\N	\N	Mano	Mano	2025-07-15 00:00:00	Chit contribution from Rajaram - 50k chit fund-07-25 Month 1	2025-07-16 04:59:12.383	2025-07-16 04:59:12.383	1	\N	1	0	0
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

SELECT pg_catalog.setval('public."Auction_id_seq"', 2, true);


--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."ChitFundFixedAmount_id_seq"', 20, true);


--
-- Name: ChitFund_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."ChitFund_id_seq"', 3, true);


--
-- Name: Contribution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Contribution_id_seq"', 30, true);


--
-- Name: EmailLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."EmailLog_id_seq"', 1, false);


--
-- Name: GlobalMember_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."GlobalMember_id_seq"', 19, true);


--
-- Name: Loan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Loan_id_seq"', 11, true);


--
-- Name: Member_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Member_id_seq"', 16, true);


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

SELECT pg_catalog.setval('public."Repayment_id_seq"', 69, true);


--
-- Name: Transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."Transaction_id_seq"', 121, true);


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

