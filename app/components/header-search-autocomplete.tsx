"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { SearchIcon } from "@/app/components/icons";
import type { StorefrontSearchSuggestItem } from "@/lib/storefront-search-suggest";
import { notifyProductSearchLoadingStart } from "@/lib/route-loading";

const HEADER_SEARCH_INPUT_CLASS =
  "min-w-0 w-full appearance-none rounded-full border-0 bg-white px-4 py-2.5 text-base leading-snug text-brand-navy shadow-none placeholder:text-brand-navy/50 focus:border-0 focus:outline-none focus:ring-0 sm:py-3 sm:text-lg";

const SUGGEST_DEBOUNCE_MS = 220;
const MIN_QUERY_LEN = 2;

type HeaderSearchAutocompleteProps = {
  onClose?: () => void;
  autoFocus?: boolean;
};

export function HeaderSearchAutocomplete({ onClose, autoFocus = false }: HeaderSearchAutocompleteProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StorefrontSearchSuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      void fetch(`/api/storefront/search-suggest?q=${encodeURIComponent(q)}&limit=8`, {
        signal: ac.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("suggest failed");
          }
          return (await res.json()) as { suggestions?: StorefrontSearchSuggestItem[] };
        })
        .then((data) => {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setOpenList(true);
          setActiveIndex(-1);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setSuggestions([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) {
            setLoading(false);
          }
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const goSearchPage = useCallback(
    (raw: string) => {
      const v = raw.trim();
      onClose?.();
      notifyProductSearchLoadingStart();
      router.push(v.length > 0 ? `/search?q=${encodeURIComponent(v)}` : "/search");
    },
    [onClose, router],
  );

  const goProduct = useCallback(
    (href: string) => {
      onClose?.();
      notifyProductSearchLoadingStart();
      router.push(href);
    },
    [onClose, router],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goProduct(suggestions[activeIndex]!.href);
      return;
    }
    goSearchPage(query);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!openList || suggestions.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }
    if (e.key === "Escape") {
      setOpenList(false);
      setActiveIndex(-1);
    }
  }

  const showPanel = openList && query.trim().length >= MIN_QUERY_LEN;

  return (
    <div className="relative w-full">
      <form className="flex w-full items-center gap-2" onSubmit={onSubmit} role="search">
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenList(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpenList(true);
            }
          }}
          onKeyDown={onKeyDown}
          enterKeyHint="search"
          placeholder="Name, colour, brand, or style code"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          className={HEADER_SEARCH_INPUT_CLASS}
        />
        <button
          type="submit"
          aria-label="Search"
          className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-brand-navy transition hover:bg-brand-surface sm:p-2.5"
        >
          <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </form>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-10 max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl border border-brand-navy/12 bg-white shadow-xl"
        >
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-brand-navy/55">Searching…</p>
          ) : null}
          {!loading && suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-brand-navy/55">No matching products.</p>
          ) : null}
          <ul className="divide-y divide-brand-navy/8 py-1">
            {suggestions.map((item, index) => {
              const active = index === activeIndex;
              return (
                <li key={item.id} role="option" aria-selected={active}>
                  <Link
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      goProduct(item.href);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 text-left transition ${
                      active ? "bg-brand-orange/15" : "hover:bg-brand-surface/80"
                    }`}
                  >
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-brand-surface/50">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-contain object-center"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-brand-navy">
                        {item.displayName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-brand-navy/55">
                        {[item.styleCode, item.supplierName, item.category].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {suggestions.length > 0 ? (
            <button
              type="button"
              onClick={() => goSearchPage(query)}
              className="w-full border-t border-brand-navy/10 px-3 py-2.5 text-left text-sm font-semibold text-brand-orange hover:bg-brand-surface/60"
            >
              See all results for “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
