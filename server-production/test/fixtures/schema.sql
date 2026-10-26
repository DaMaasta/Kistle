-- Schema-only Dump der Produktions-DB (pg_dump -s, 2026-10-26) für die Integrationstests.
-- Neu erzeugen: docker exec postgres pg_dump -s --no-owner --no-privileges ...
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)


--
--



--
--



--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;




--
-- Name: booking_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_items (
    id bigint NOT NULL,
    booking_id text NOT NULL,
    product_id text,
    product_name text NOT NULL,
    quantity numeric NOT NULL,
    unit text NOT NULL,
    image_url text,
    box_id text NOT NULL,
    box_name text NOT NULL,
    parent_id text,
    parent_name text DEFAULT ''::text NOT NULL
);


--
-- Name: booking_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_items_id_seq OWNED BY public.booking_items.id;


--
-- Name: booking_parent_spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_parent_spaces (
    booking_id text NOT NULL,
    space_id text NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id text NOT NULL,
    user_display_name text NOT NULL,
    user_email text NOT NULL,
    type text NOT NULL,
    original_booking_id text,
    is_returned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bookings_type_check CHECK ((type = ANY (ARRAY['booking'::text, 'return'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'file'::text NOT NULL,
    owner_id text NOT NULL,
    folder_id text,
    file_path text,
    created_at timestamp with time zone DEFAULT now(),
    size bigint DEFAULT 0,
    mime_type text DEFAULT ''::text
);


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id text NOT NULL,
    name text NOT NULL,
    owner_id text NOT NULL,
    parent_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    target_user_id text NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    booking_user_name text NOT NULL,
    group_id text NOT NULL,
    group_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read boolean DEFAULT false NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['booking'::text, 'return'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    space_id text NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    min_quantity numeric,
    unit text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    barcode text,
    image_url text,
    color text,
    last_modified_by text NOT NULL,
    last_modified_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_unit_check CHECK ((unit = ANY (ARRAY['Stück'::text, 'kg'::text, 'g'::text, 'L'::text, 'ml'::text, 'Packung'::text, 'Flasche'::text, 'Dose'::text, 'Paar'::text, 'Box'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: space_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_members (
    space_id text NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    CONSTRAINT space_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text])))
);


--
-- Name: spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spaces (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    type text NOT NULL,
    parent_id text,
    owner_id text NOT NULL,
    icon text DEFAULT ''::text NOT NULL,
    color text DEFAULT ''::text NOT NULL,
    is_group boolean DEFAULT false NOT NULL,
    access_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_id text,
    box_number integer,
    CONSTRAINT spaces_non_group_needs_parent CHECK (((is_group = true) OR (parent_id IS NOT NULL))),
    CONSTRAINT spaces_type_check CHECK ((type = ANY (ARRAY['room'::text, 'box'::text, 'trolley'::text, 'kiste'::text, 'karton'::text, 'regal'::text, 'other'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    uid text NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    photo_url text DEFAULT ''::text,
    password_hash text
);


--
-- Name: booking_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items ALTER COLUMN id SET DEFAULT nextval('public.booking_items_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: booking_items booking_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_pkey PRIMARY KEY (id);


--
-- Name: booking_parent_spaces booking_parent_spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_parent_spaces
    ADD CONSTRAINT booking_parent_spaces_pkey PRIMARY KEY (booking_id, space_id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: space_members space_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_members
    ADD CONSTRAINT space_members_pkey PRIMARY KEY (space_id, user_id);


--
-- Name: spaces spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (uid);


--
-- Name: idx_booking_items_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_items_booking ON public.booking_items USING btree (booking_id);


--
-- Name: idx_bookings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);


--
-- Name: idx_notifications_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_target ON public.notifications USING btree (target_user_id) WHERE (read = false);


--
-- Name: idx_products_space; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_space ON public.products USING btree (space_id);


--
-- Name: idx_push_sub_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_sub_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_space_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_space_members_user ON public.space_members USING btree (user_id);


--
-- Name: idx_spaces_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_owner ON public.spaces USING btree (owner_id);


--
-- Name: idx_spaces_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spaces_parent ON public.spaces USING btree (parent_id);


--
-- Name: spaces trg_spaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: booking_items booking_items_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_items booking_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: booking_parent_spaces booking_parent_spaces_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_parent_spaces
    ADD CONSTRAINT booking_parent_spaces_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_parent_spaces booking_parent_spaces_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_parent_spaces
    ADD CONSTRAINT booking_parent_spaces_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_original_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_original_booking_id_fkey FOREIGN KEY (original_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(uid);


--
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: products products_last_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES public.users(uid);


--
-- Name: products products_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: space_members space_members_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_members
    ADD CONSTRAINT space_members_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;


--
-- Name: space_members space_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_members
    ADD CONSTRAINT space_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: spaces spaces_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: spaces spaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: spaces spaces_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


