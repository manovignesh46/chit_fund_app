--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: RepaymentType; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."RepaymentType" AS ENUM (
    'REGULAR',
    'INTEREST_ONLY',
    'PARTIAL'
);


ALTER TYPE public."RepaymentType" OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Auction; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."Auction" OWNER TO admin;

--
-- Name: Auction_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Auction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Auction_id_seq" OWNER TO admin;

--
-- Name: Auction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Auction_id_seq" OWNED BY public."Auction".id;


--
-- Name: ChitFund; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."ChitFund" OWNER TO admin;

--
-- Name: ChitFundFixedAmount; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public."ChitFundFixedAmount" (
    id integer NOT NULL,
    "chitFundId" integer NOT NULL,
    month integer NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ChitFundFixedAmount" OWNER TO admin;

--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."ChitFundFixedAmount_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ChitFundFixedAmount_id_seq" OWNER TO admin;

--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."ChitFundFixedAmount_id_seq" OWNED BY public."ChitFundFixedAmount".id;


--
-- Name: ChitFund_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."ChitFund_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ChitFund_id_seq" OWNER TO admin;

--
-- Name: ChitFund_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."ChitFund_id_seq" OWNED BY public."ChitFund".id;


--
-- Name: Contribution; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."Contribution" OWNER TO admin;

--
-- Name: Contribution_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Contribution_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Contribution_id_seq" OWNER TO admin;

--
-- Name: Contribution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Contribution_id_seq" OWNED BY public."Contribution".id;


--
-- Name: EmailLog; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."EmailLog" OWNER TO admin;

--
-- Name: EmailLog_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."EmailLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."EmailLog_id_seq" OWNER TO admin;

--
-- Name: EmailLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."EmailLog_id_seq" OWNED BY public."EmailLog".id;


--
-- Name: GlobalMember; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."GlobalMember" OWNER TO admin;

--
-- Name: GlobalMember_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."GlobalMember_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."GlobalMember_id_seq" OWNER TO admin;

--
-- Name: GlobalMember_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."GlobalMember_id_seq" OWNED BY public."GlobalMember".id;


--
-- Name: Loan; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."Loan" OWNER TO admin;

--
-- Name: Loan_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Loan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Loan_id_seq" OWNER TO admin;

--
-- Name: Loan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Loan_id_seq" OWNED BY public."Loan".id;


--
-- Name: Member; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."Member" OWNER TO admin;

--
-- Name: Member_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Member_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Member_id_seq" OWNER TO admin;

--
-- Name: Member_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Member_id_seq" OWNED BY public."Member".id;


--
-- Name: Partner; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."Partner" OWNER TO admin;

--
-- Name: PartnerMonthlySummary; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public."PartnerMonthlySummary" (
    id integer NOT NULL,
    "partnerId" integer NOT NULL,
    "closingBalance" double precision DEFAULT 0 NOT NULL,
    "loanRepayment" double precision DEFAULT 0 NOT NULL,
    "loanDisbursement" double precision DEFAULT 0 NOT NULL,
    "chitContributions" double precision DEFAULT 0 NOT NULL,
    "auctionPayout" double precision DEFAULT 0 NOT NULL,
    "remainingAmount" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL
);


ALTER TABLE public."PartnerMonthlySummary" OWNER TO admin;

--
-- Name: PartnerMonthlySummary_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."PartnerMonthlySummary_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."PartnerMonthlySummary_id_seq" OWNER TO admin;

--
-- Name: PartnerMonthlySummary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."PartnerMonthlySummary_id_seq" OWNED BY public."PartnerMonthlySummary".id;


--
-- Name: Partner_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Partner_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Partner_id_seq" OWNER TO admin;

--
-- Name: Partner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Partner_id_seq" OWNED BY public."Partner".id;


--
-- Name: PaymentSchedule; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."PaymentSchedule" OWNER TO admin;

--
-- Name: PaymentSchedule_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."PaymentSchedule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."PaymentSchedule_id_seq" OWNER TO admin;

--
-- Name: PaymentSchedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."PaymentSchedule_id_seq" OWNED BY public."PaymentSchedule".id;


--
-- Name: Repayment; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."Repayment" OWNER TO admin;

--
-- Name: Repayment_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Repayment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Repayment_id_seq" OWNER TO admin;

--
-- Name: Repayment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Repayment_id_seq" OWNED BY public."Repayment".id;


--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: admin
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
    to_partner_id integer
);


ALTER TABLE public."Transaction" OWNER TO admin;

--
-- Name: Transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."Transaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Transaction_id_seq" OWNER TO admin;

--
-- Name: Transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."Transaction_id_seq" OWNED BY public."Transaction".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public."User" OWNER TO admin;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."User_id_seq" OWNER TO admin;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: admin
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


ALTER TABLE public._prisma_migrations OWNER TO admin;

--
-- Name: Auction id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction" ALTER COLUMN id SET DEFAULT nextval('public."Auction_id_seq"'::regclass);


--
-- Name: ChitFund id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."ChitFund" ALTER COLUMN id SET DEFAULT nextval('public."ChitFund_id_seq"'::regclass);


--
-- Name: ChitFundFixedAmount id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."ChitFundFixedAmount" ALTER COLUMN id SET DEFAULT nextval('public."ChitFundFixedAmount_id_seq"'::regclass);


--
-- Name: Contribution id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution" ALTER COLUMN id SET DEFAULT nextval('public."Contribution_id_seq"'::regclass);


--
-- Name: EmailLog id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."EmailLog" ALTER COLUMN id SET DEFAULT nextval('public."EmailLog_id_seq"'::regclass);


--
-- Name: GlobalMember id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."GlobalMember" ALTER COLUMN id SET DEFAULT nextval('public."GlobalMember_id_seq"'::regclass);


--
-- Name: Loan id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan" ALTER COLUMN id SET DEFAULT nextval('public."Loan_id_seq"'::regclass);


--
-- Name: Member id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Member" ALTER COLUMN id SET DEFAULT nextval('public."Member_id_seq"'::regclass);


--
-- Name: Partner id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Partner" ALTER COLUMN id SET DEFAULT nextval('public."Partner_id_seq"'::regclass);


--
-- Name: PartnerMonthlySummary id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."PartnerMonthlySummary" ALTER COLUMN id SET DEFAULT nextval('public."PartnerMonthlySummary_id_seq"'::regclass);


--
-- Name: PaymentSchedule id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."PaymentSchedule" ALTER COLUMN id SET DEFAULT nextval('public."PaymentSchedule_id_seq"'::regclass);


--
-- Name: Repayment id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment" ALTER COLUMN id SET DEFAULT nextval('public."Repayment_id_seq"'::regclass);


--
-- Name: Transaction id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Transaction" ALTER COLUMN id SET DEFAULT nextval('public."Transaction_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Auction; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Auction" (id, "chitFundId", month, date, "winnerId", amount, "lowestBid", "highestBid", "numberOfBidders", notes, "createdAt", "updatedAt", disbursed_by_id, entered_by_id, "transactionId") FROM stdin;
\.


--
-- Data for Name: ChitFund; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."ChitFund" (id, name, "totalAmount", "monthlyContribution", "firstMonthContribution", duration, "membersCount", status, "startDate", "currentMonth", "nextAuctionDate", description, "chitFundType", "createdAt", "updatedAt", "createdById") FROM stdin;
\.


--
-- Data for Name: ChitFundFixedAmount; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."ChitFundFixedAmount" (id, "chitFundId", month, amount, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Contribution; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Contribution" (id, amount, month, "paidDate", "memberId", "chitFundId", balance, "balancePaymentDate", "balancePaymentStatus", "actualBalancePaymentDate", notes, collected_by_id, entered_by_id, "createdById", "createdAt", "updatedAt", "transactionId") FROM stdin;
\.


--
-- Data for Name: EmailLog; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."EmailLog" (id, "emailType", period, "sentDate", status, recipients, "fileName", "isRecovery", "errorMessage", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: GlobalMember; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."GlobalMember" (id, name, contact, email, address, notes, "createdAt", "updatedAt", "createdById") FROM stdin;
\.


--
-- Data for Name: Loan; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Loan" (id, "borrowerId", "loanType", amount, "interestRate", "documentCharge", "currentMonth", "installmentAmount", duration, "disbursementDate", "repaymentType", "remainingAmount", "overdueAmount", "missedPayments", "nextPaymentDate", status, purpose, "createdAt", "updatedAt", "createdById", disbursed_by_id, entered_by_id, "transactionId") FROM stdin;
\.


--
-- Data for Name: Member; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Member" (id, "globalMemberId", "chitFundId", "joinDate", "auctionWon", "auctionMonth", contribution, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Partner; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Partner" (id, name, code, "isActive", "createdAt", "updatedAt", "createdById") FROM stdin;
1	Mano	ADMIN	t	2025-07-12 06:04:21.117	2025-07-12 06:04:21.117	1
2	Arul	PARTNER	t	2025-07-12 06:04:21.135	2025-07-12 06:04:21.135	1
\.


--
-- Data for Name: PartnerMonthlySummary; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."PartnerMonthlySummary" (id, "partnerId", "closingBalance", "loanRepayment", "loanDisbursement", "chitContributions", "auctionPayout", "remainingAmount", "createdAt", "updatedAt", year, month) FROM stdin;
1	1	0	0	0	0	0	0	2025-07-12 06:08:31.71	2025-07-12 06:08:31.71	2025	7
2	2	0	0	0	0	0	0	2025-07-12 06:08:31.711	2025-07-12 06:08:31.711	2025	7
3	2	0	0	0	0	0	0	2025-07-12 06:08:48.208	2025-07-12 06:08:48.208	2025	1
4	1	0	0	0	0	0	0	2025-07-12 06:08:48.209	2025-07-12 06:10:29.175	2025	1
6	2	0	0	0	0	0	0	2025-07-12 06:46:25.635	2025-07-12 06:46:25.635	2025	6
7	1	0	0	0	0	0	0	2025-07-12 06:46:25.641	2025-07-12 06:46:25.641	2025	6
8	1	0	0	0	0	0	0	2025-07-12 06:46:28.221	2025-07-12 06:46:28.221	2025	5
9	2	0	0	0	0	0	0	2025-07-12 06:46:28.222	2025-07-12 06:46:28.222	2025	5
\.


--
-- Data for Name: PaymentSchedule; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."PaymentSchedule" (id, "loanId", period, "dueDate", amount, status, "actualPaymentDate", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Repayment; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Repayment" (id, amount, "paidDate", period, "loanId", "createdAt", "updatedAt", "paymentType", collected_by_id, "createdById", entered_by_id, "transactionId") FROM stdin;
\.


--
-- Data for Name: Transaction; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."Transaction" (id, type, amount, from_partner, to_partner, action_performer, entered_by, date, note, "createdAt", "updatedAt", "createdById", from_partner_id, to_partner_id) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public."User" (id, name, email, password, role, "createdAt", "updatedAt") FROM stdin;
1	Admin User	amfincorp1@gmail.com	$2b$10$m5q/narY8g1U3z.LD3HoYud9S7snwk7.4p8WPmYDrZD20H5H998OC	admin	2025-07-12 05:59:16.8	2025-07-12 05:59:16.8
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
3c706ec1-270e-4443-b108-1f8109ef583d	556b1930d0fbfad3bc12787e379b68742d5bfa0fa59199666e6e2153e2729ffc	2025-07-12 11:29:12.50223+05:30	20250712051558_update_partner_monthly_summary	\N	\N	2025-07-12 11:29:12.398783+05:30	1
ea6a75a5-939e-462f-946d-4efd82ad1d0f	6b692b2e975099e71ed6efad95bff228a9eace08732cd5ee37661d0fca7e5be2	2025-07-12 11:29:12.507639+05:30	20250712054252_partner_monthly_summary_month_year	\N	\N	2025-07-12 11:29:12.503084+05:30	1
\.


--
-- Name: Auction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Auction_id_seq"', 1, false);


--
-- Name: ChitFundFixedAmount_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."ChitFundFixedAmount_id_seq"', 1, false);


--
-- Name: ChitFund_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."ChitFund_id_seq"', 1, false);


--
-- Name: Contribution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Contribution_id_seq"', 1, false);


--
-- Name: EmailLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."EmailLog_id_seq"', 1, false);


--
-- Name: GlobalMember_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."GlobalMember_id_seq"', 1, false);


--
-- Name: Loan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Loan_id_seq"', 1, false);


--
-- Name: Member_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Member_id_seq"', 1, false);


--
-- Name: PartnerMonthlySummary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."PartnerMonthlySummary_id_seq"', 9, true);


--
-- Name: Partner_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Partner_id_seq"', 2, true);


--
-- Name: PaymentSchedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."PaymentSchedule_id_seq"', 1, false);


--
-- Name: Repayment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Repayment_id_seq"', 1, false);


--
-- Name: Transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."Transaction_id_seq"', 1, false);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public."User_id_seq"', 1, true);


--
-- Name: Auction Auction_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_pkey" PRIMARY KEY (id);


--
-- Name: ChitFundFixedAmount ChitFundFixedAmount_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."ChitFundFixedAmount"
    ADD CONSTRAINT "ChitFundFixedAmount_pkey" PRIMARY KEY (id);


--
-- Name: ChitFund ChitFund_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."ChitFund"
    ADD CONSTRAINT "ChitFund_pkey" PRIMARY KEY (id);


--
-- Name: Contribution Contribution_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_pkey" PRIMARY KEY (id);


--
-- Name: EmailLog EmailLog_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY (id);


--
-- Name: GlobalMember GlobalMember_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."GlobalMember"
    ADD CONSTRAINT "GlobalMember_pkey" PRIMARY KEY (id);


--
-- Name: Loan Loan_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_pkey" PRIMARY KEY (id);


--
-- Name: Member Member_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_pkey" PRIMARY KEY (id);


--
-- Name: PartnerMonthlySummary PartnerMonthlySummary_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."PartnerMonthlySummary"
    ADD CONSTRAINT "PartnerMonthlySummary_pkey" PRIMARY KEY (id);


--
-- Name: Partner Partner_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Partner"
    ADD CONSTRAINT "Partner_pkey" PRIMARY KEY (id);


--
-- Name: PaymentSchedule PaymentSchedule_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."PaymentSchedule"
    ADD CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY (id);


--
-- Name: Repayment Repayment_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Auction_chitFundId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Auction_chitFundId_idx" ON public."Auction" USING btree ("chitFundId");


--
-- Name: Auction_disbursed_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Auction_disbursed_by_id_idx" ON public."Auction" USING btree (disbursed_by_id);


--
-- Name: Auction_entered_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Auction_entered_by_id_idx" ON public."Auction" USING btree (entered_by_id);


--
-- Name: Auction_transactionId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Auction_transactionId_idx" ON public."Auction" USING btree ("transactionId");


--
-- Name: Auction_transactionId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "Auction_transactionId_key" ON public."Auction" USING btree ("transactionId");


--
-- Name: Auction_winnerId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Auction_winnerId_idx" ON public."Auction" USING btree ("winnerId");


--
-- Name: ChitFundFixedAmount_chitFundId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "ChitFundFixedAmount_chitFundId_idx" ON public."ChitFundFixedAmount" USING btree ("chitFundId");


--
-- Name: ChitFundFixedAmount_chitFundId_month_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "ChitFundFixedAmount_chitFundId_month_key" ON public."ChitFundFixedAmount" USING btree ("chitFundId", month);


--
-- Name: ChitFund_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "ChitFund_createdById_idx" ON public."ChitFund" USING btree ("createdById");


--
-- Name: Contribution_chitFundId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Contribution_chitFundId_idx" ON public."Contribution" USING btree ("chitFundId");


--
-- Name: Contribution_collected_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Contribution_collected_by_id_idx" ON public."Contribution" USING btree (collected_by_id);


--
-- Name: Contribution_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Contribution_createdById_idx" ON public."Contribution" USING btree ("createdById");


--
-- Name: Contribution_entered_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Contribution_entered_by_id_idx" ON public."Contribution" USING btree (entered_by_id);


--
-- Name: Contribution_memberId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Contribution_memberId_idx" ON public."Contribution" USING btree ("memberId");


--
-- Name: Contribution_transactionId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Contribution_transactionId_idx" ON public."Contribution" USING btree ("transactionId");


--
-- Name: Contribution_transactionId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "Contribution_transactionId_key" ON public."Contribution" USING btree ("transactionId");


--
-- Name: EmailLog_emailType_period_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "EmailLog_emailType_period_key" ON public."EmailLog" USING btree ("emailType", period);


--
-- Name: EmailLog_emailType_sentDate_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "EmailLog_emailType_sentDate_idx" ON public."EmailLog" USING btree ("emailType", "sentDate");


--
-- Name: GlobalMember_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "GlobalMember_createdById_idx" ON public."GlobalMember" USING btree ("createdById");


--
-- Name: Loan_borrowerId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Loan_borrowerId_idx" ON public."Loan" USING btree ("borrowerId");


--
-- Name: Loan_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Loan_createdById_idx" ON public."Loan" USING btree ("createdById");


--
-- Name: Loan_disbursed_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Loan_disbursed_by_id_idx" ON public."Loan" USING btree (disbursed_by_id);


--
-- Name: Loan_entered_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Loan_entered_by_id_idx" ON public."Loan" USING btree (entered_by_id);


--
-- Name: Loan_transactionId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Loan_transactionId_idx" ON public."Loan" USING btree ("transactionId");


--
-- Name: Loan_transactionId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "Loan_transactionId_key" ON public."Loan" USING btree ("transactionId");


--
-- Name: Member_chitFundId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Member_chitFundId_idx" ON public."Member" USING btree ("chitFundId");


--
-- Name: Member_globalMemberId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Member_globalMemberId_idx" ON public."Member" USING btree ("globalMemberId");


--
-- Name: PartnerMonthlySummary_partnerId_month_year_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "PartnerMonthlySummary_partnerId_month_year_key" ON public."PartnerMonthlySummary" USING btree ("partnerId", month, year);


--
-- Name: Partner_createdById_code_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "Partner_createdById_code_key" ON public."Partner" USING btree ("createdById", code);


--
-- Name: Partner_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Partner_createdById_idx" ON public."Partner" USING btree ("createdById");


--
-- Name: PaymentSchedule_loanId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "PaymentSchedule_loanId_idx" ON public."PaymentSchedule" USING btree ("loanId");


--
-- Name: Repayment_collected_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Repayment_collected_by_id_idx" ON public."Repayment" USING btree (collected_by_id);


--
-- Name: Repayment_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Repayment_createdById_idx" ON public."Repayment" USING btree ("createdById");


--
-- Name: Repayment_entered_by_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Repayment_entered_by_id_idx" ON public."Repayment" USING btree (entered_by_id);


--
-- Name: Repayment_loanId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Repayment_loanId_idx" ON public."Repayment" USING btree ("loanId");


--
-- Name: Repayment_paidDate_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Repayment_paidDate_idx" ON public."Repayment" USING btree ("paidDate");


--
-- Name: Repayment_transactionId_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Repayment_transactionId_idx" ON public."Repayment" USING btree ("transactionId");


--
-- Name: Repayment_transactionId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "Repayment_transactionId_key" ON public."Repayment" USING btree ("transactionId");


--
-- Name: Transaction_createdById_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Transaction_createdById_idx" ON public."Transaction" USING btree ("createdById");


--
-- Name: Transaction_date_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Transaction_date_idx" ON public."Transaction" USING btree (date);


--
-- Name: Transaction_from_partner_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Transaction_from_partner_id_idx" ON public."Transaction" USING btree (from_partner_id);


--
-- Name: Transaction_to_partner_id_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Transaction_to_partner_id_idx" ON public."Transaction" USING btree (to_partner_id);


--
-- Name: Transaction_type_idx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX "Transaction_type_idx" ON public."Transaction" USING btree (type);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Auction Auction_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Auction Auction_disbursed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_disbursed_by_id_fkey" FOREIGN KEY (disbursed_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auction Auction_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auction Auction_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auction Auction_winnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChitFundFixedAmount ChitFundFixedAmount_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."ChitFundFixedAmount"
    ADD CONSTRAINT "ChitFundFixedAmount_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChitFund ChitFund_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."ChitFund"
    ADD CONSTRAINT "ChitFund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contribution Contribution_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contribution Contribution_collected_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_collected_by_id_fkey" FOREIGN KEY (collected_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contribution Contribution_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contribution Contribution_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contribution Contribution_memberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES public."Member"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contribution Contribution_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Contribution"
    ADD CONSTRAINT "Contribution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GlobalMember GlobalMember_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."GlobalMember"
    ADD CONSTRAINT "GlobalMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_borrowerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES public."GlobalMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_disbursed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_disbursed_by_id_fkey" FOREIGN KEY (disbursed_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Member Member_chitFundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_chitFundId_fkey" FOREIGN KEY ("chitFundId") REFERENCES public."ChitFund"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Member Member_globalMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Member"
    ADD CONSTRAINT "Member_globalMemberId_fkey" FOREIGN KEY ("globalMemberId") REFERENCES public."GlobalMember"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartnerMonthlySummary PartnerMonthlySummary_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."PartnerMonthlySummary"
    ADD CONSTRAINT "PartnerMonthlySummary_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Partner Partner_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Partner"
    ADD CONSTRAINT "Partner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentSchedule PaymentSchedule_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."PaymentSchedule"
    ADD CONSTRAINT "PaymentSchedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Repayment Repayment_collected_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_collected_by_id_fkey" FOREIGN KEY (collected_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Repayment Repayment_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Repayment Repayment_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_entered_by_id_fkey" FOREIGN KEY (entered_by_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Repayment Repayment_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Repayment Repayment_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Repayment"
    ADD CONSTRAINT "Repayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public."Transaction"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Transaction Transaction_from_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_from_partner_id_fkey" FOREIGN KEY (from_partner_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_to_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_to_partner_id_fkey" FOREIGN KEY (to_partner_id) REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

